import { useRef, useState, useMemo } from "react";
import { Modal, ModalHeader } from "../../../shared/components/ui/Modal.tsx";
import { getIntercomText, attachStream, clearStream } from "../utils/media";
import { ICE_SERVERS, AUDIO_CONSTRAINTS, CHIME_ENDPOINT } from "../config";
import { useRemoteAudioSync } from "../hooks/useRemoteAudioSync";
import { useSignalingBootstrap } from "../hooks/useSignalingBootstrap";
import { useIntercom } from "../hooks/useIntercom";
import { makeNewPeer } from "../rtc/peer";
import "./DoorbellModal.css";
import DoorbellStatus from "./DoorbellStatus.tsx";
import DoorbellControls from "./DoorbellControls.tsx";

export default function DoorbellModal() {
    // Refs
    const wsRef = useRef<WebSocket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const chimeTriggeredRef = useRef<boolean>(false);

    // State
    const [wsOpen, setWsOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [remoteMuted, setRemoteMuted] = useState(false);
    const [remoteVolume, setRemoteVolume] = useState(1);
    const [sigState, setSigState] = useState<RTCSignalingState>("stable");
    const [iceConn, setIceConn] = useState<RTCIceConnectionState>("new");
    const [err, setErr] = useState<string | null>(null);

    if (!import.meta.env.VITE_SIGNALING_WS_URL) {
        throw new Error("VITE_SIGNALING_WS_URL muss gesetzt sein!");
    }
    const WS_URL: string = import.meta.env.VITE_SIGNALING_WS_URL;

    function closeModalAndCleanup() {
        setModalOpen(false);
        cleanup();
    }

    function resetMediaEls() {
        clearStream(remoteVideoRef.current);
        const a = remoteAudioRef.current;
        if (a) {
            clearStream(a);
            a.muted = true;
            a.volume = 1;
        }
    }

    // Intercom
    const {
        intercomReady,
        micOn,
        hasMicTrack,
        canStartIntercom,
        prepareForCall,
        startIntercom,
        toggleMic,
        pttDown,
        pttUp,
        reset: resetIntercom,
    } = useIntercom({ pcRef, audioConstraints: AUDIO_CONSTRAINTS, onError: setErr });

    // Peer-Fabrik
    const newPeer = makeNewPeer({
        wsRef,
        iceServers: ICE_SERVERS,
        onSig: setSigState,
        onIce: (s) => {
            setIceConn(s);
            if (s === "failed" || s === "disconnected" || s === "closed") {
                closeModalAndCleanup();
            }
        },
        onStream: (stream) => {
            const v = remoteVideoRef.current;
            const a = remoteAudioRef.current;
            if (v) {
                attachStream(v, stream);
                v.muted = true;
                v.play().catch((e) => console.debug("remote video autoplay deferred:", e));
            }
            if (a) attachStream(a, stream);
        },
    });

    // Signaling helpers
    async function setRemoteOffer(pc: RTCPeerConnection, data: RTCSessionDescriptionInit) {
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            return true;
        } catch (ex) {
            const m = ex instanceof Error ? ex.message : String(ex);
            console.error("setRemoteDescription(offer) failed:", ex);
            setErr(`Offer konnte nicht gesetzt werden: ${m}`);
            return false;
        }
    }

    async function triggerChimeOnce() {
        if (chimeTriggeredRef.current) return;
        chimeTriggeredRef.current = true;
        try {
            const resp = await fetch(CHIME_ENDPOINT, { method: "POST" });
            if (!resp.ok) {
                const text = await resp.text().catch(() => "");
                console.warn("Chime trigger failed:", resp.status, text);
            }
        } catch (e) {
            console.warn("Chime trigger error:", e);
        }
    }

    async function sendAnswer(pc: RTCPeerConnection, ws: WebSocket | null) {
        try {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws?.send(JSON.stringify({ event: "answer", data: answer }));
            return true;
        } catch (ex) {
            const m = ex instanceof Error ? ex.message : String(ex);
            console.error("Answering failed:", ex);
            setErr(`Answer fehlgeschlagen: ${m}`);
            return false;
        }
    }

    async function handleOffer(data: RTCSessionDescriptionInit) {
        const pc = pcRef.current;
        if (!pc) return;

        const state = pc.signalingState;
        const okState = state === "stable" || state === "have-remote-offer";
        if (!okState) {
            console.warn("Ignoring offer in state:", state);
            return;
        }

        // UI sofort; Chime fire-and-forget
        setModalOpen(true);
        setErr(null);
        void triggerChimeOnce();

        const okRemote = await setRemoteOffer(pc, data);
        if (!okRemote) return;

        await prepareForCall();
        await sendAnswer(pc, wsRef.current);
    }

    async function handleCandidate(data: RTCIceCandidateInit) {
        const pc = pcRef.current;
        if (!pc) return;
        try {
            await pc.addIceCandidate(new RTCIceCandidate(data));
        } catch (ex) {
            console.warn("addIceCandidate (hub) failed:", ex);
        }
    }

    function handleBye() {
        closeModalAndCleanup();
    }

    // Bootstrap WS + Peer
    useSignalingBootstrap(WS_URL, wsRef, pcRef, {
        setWsOpen,
        newPeer,
        onOffer: handleOffer,
        onCandidate: handleCandidate,
        onBye: handleBye,
    });

    // Audio-Ref syncen
    useRemoteAudioSync(remoteAudioRef, soundEnabled, remoteMuted, remoteVolume);

    // Cleanup Wrapper
    function cleanup() {
        try {
            pcRef.current?.getSenders().forEach((s) => s.track?.stop());
        } catch (e) {
            console.warn("cleanup stop senders failed:", e);
        }
        try {
            pcRef.current?.close();
        } catch (e) {
            console.warn("cleanup pc close failed:", e);
        }

        pcRef.current = newPeer(); // bereit für nächsten Call
        resetMediaEls();
        resetIntercom();
        chimeTriggeredRef.current = false;

        setSoundEnabled(false);
        setRemoteMuted(false);
        setRemoteVolume(1);
        setErr(null);
    }

    // UI-Actions
    async function enableSound() {
        const a = remoteAudioRef.current;
        if (!a) return;
        try {
            a.muted = false;
            await a.play();
            setSoundEnabled(true);
            setRemoteMuted(false);
        } catch (ex) {
            const m = ex instanceof Error ? ex.message : String(ex);
            console.warn("enableSound play failed:", ex);
            setErr(`Audio konnte nicht gestartet werden: ${m}`);
        }
    }
    function toggleRemoteMute() {
        const a = remoteAudioRef.current;
        if (!a) return;
        a.muted = !a.muted;
        setRemoteMuted(a.muted);
    }
    function changeRemoteVolume(v: number) {
        const a = remoteAudioRef.current;
        if (!a) return;
        a.volume = v;
        setRemoteVolume(v);
    }

    function hangup() {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ event: "bye" }));
            } catch (e) {
                console.debug("send bye failed:", e);
            }
        }
        closeModalAndCleanup();
    }

    const intercomText = useMemo(
        () => getIntercomText(intercomReady, micOn),
        [intercomReady, micOn]
    );

    return (
        <div>
            <Modal open={modalOpen} onClose={hangup} titleId="doorbell-title">
                <ModalHeader title="Klingel" titleId="doorbell-title" onClose={hangup} />
                <div>
                    <div className="doorbell-video-container">
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="doorbell-video"
                        />
                    </div>

                    <audio ref={remoteAudioRef} autoPlay muted />

                    <DoorbellControls
                        soundEnabled={soundEnabled}
                        remoteMuted={remoteMuted}
                        remoteVolume={remoteVolume}
                        canStartIntercom={canStartIntercom}
                        micOn={micOn}
                        hasMicTrack={hasMicTrack}
                        iceConn={iceConn}
                        onEnableSound={enableSound}
                        onToggleRemoteMute={toggleRemoteMute}
                        onChangeRemoteVolume={changeRemoteVolume}
                        onStartIntercom={startIntercom}
                        onToggleMic={toggleMic}
                        onPttDown={pttDown}
                        onPttUp={pttUp}
                    />
                    <DoorbellStatus
                        wsOpen={wsOpen}
                        sigState={sigState}
                        iceConn={iceConn}
                        modalOpen={modalOpen}
                        intercomText={intercomText}
                        err={err}
                    />
                </div>
            </Modal>
        </div>
    );
}
