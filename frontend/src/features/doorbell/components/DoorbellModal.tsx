// src/features/doorbell/components/DoorbellModal.tsx
import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Modal, ModalHeader } from "../../../shared/components/ui/Modal.tsx";
import { getIntercomText, attachStream, clearStream } from "../utils/media";
import { ICE_SERVERS, AUDIO_CONSTRAINTS, CHIME_ENDPOINT } from "../config";
import { useRemoteAudioSync } from "../hooks/useRemoteAudioSync";
import { useSignalingBootstrap } from "../hooks/useSignalingBootstrap";
import { useIntercom } from "../hooks/useIntercom";
import { makeNewPeer } from "../rtc/peer";
import { setRemoteOfferSafe, sendAnswerSafe } from "../rtc/sdp";
import { triggerChimeOnce } from "../utils/chime";
import { addCandidateSafe } from "../rtc/candidate";
import "./DoorbellModal.css";
import DoorbellStatus from "./DoorbellStatus.tsx";
import DoorbellControls from "./DoorbellControls.tsx";

const BAD_ICE = new Set<RTCIceConnectionState>(["failed", "disconnected", "closed"]);

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

    // Media-Reset
    const resetMediaEls = useCallback(() => {
        clearStream(remoteVideoRef.current);
        const a = remoteAudioRef.current;
        if (a) {
            try {
                a.pause();
            } catch (e) {
                console.debug("audio pause failed:", e);
            }
            clearStream(a);
            a.muted = true;
            a.volume = 1;
        }
    }, []);

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
    const newPeer = useMemo(
        () =>
            makeNewPeer({
                wsRef,
                iceServers: ICE_SERVERS,
                onSig: setSigState,
                onIce: setIceConn,
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
            }),
        []
    );

    // Cleanup Wrapper
    const cleanup = useCallback(() => {
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
    }, [newPeer, resetMediaEls, resetIntercom]);

    const closeModalAndCleanup = useCallback(() => {
        setModalOpen(false);
        cleanup();
    }, [cleanup]);

    useEffect(() => {
        if (BAD_ICE.has(iceConn)) {
            closeModalAndCleanup();
        }
    }, [iceConn, closeModalAndCleanup]);

    // Offer-Flow
    const handleOffer = useCallback(
        async (data: RTCSessionDescriptionInit) => {
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
            void triggerChimeOnce(chimeTriggeredRef, CHIME_ENDPOINT);

            const resOffer = await setRemoteOfferSafe(pc, data);
            if (!resOffer.ok) {
                setErr(`Offer konnte nicht gesetzt werden: ${resOffer.error}`);
                return;
            }

            await prepareForCall();

            const resAns = await sendAnswerSafe(pc, wsRef.current);
            if (!resAns.ok) {
                setErr(`Answer fehlgeschlagen: ${resAns.error}`);
            }
        },
        [prepareForCall]
    );

    const handleCandidate = useCallback(async (data: RTCIceCandidateInit) => {
        const pc = pcRef.current;
        if (!pc) return;
        const res = await addCandidateSafe(pc, data);
        if (!res.ok) {
            console.warn("addIceCandidate (hub) failed:", res.error);
        }
    }, []);

    const handleBye = closeModalAndCleanup;

    // Bootstrap WS + Peer
    const signalingHandlers = useMemo(
        () => ({
            setWsOpen,
            newPeer,
            onOffer: handleOffer,
            onCandidate: handleCandidate,
            onBye: handleBye,
        }),
        [newPeer, handleOffer, handleCandidate, handleBye]
    );
    useSignalingBootstrap(WS_URL, wsRef, pcRef, signalingHandlers);

    // Audio-Ref syncen
    useRemoteAudioSync(remoteAudioRef, soundEnabled, remoteMuted, remoteVolume);

    // UI-Actions
    const enableSound = useCallback(async () => {
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
    }, []);

    const toggleRemoteMute = useCallback(() => {
        const a = remoteAudioRef.current;
        if (!a) return;
        a.muted = !a.muted;
        setRemoteMuted(a.muted);
    }, []);

    const changeRemoteVolume = useCallback((v: number) => {
        const a = remoteAudioRef.current;
        if (!a) return;
        a.volume = v;
        setRemoteVolume(v);
    }, []);

    const hangup = useCallback(() => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ event: "bye" }));
            } catch (e) {
                console.debug("send bye failed:", e);
            }
        }
        closeModalAndCleanup();
    }, [closeModalAndCleanup]);

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
