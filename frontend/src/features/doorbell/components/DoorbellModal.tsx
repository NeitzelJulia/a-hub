import { useEffect, useRef, useState, useMemo } from "react";
import { Modal, ModalHeader } from "../../../shared/components/ui/Modal.tsx";
import { getIntercomText, attachStream, clearStream } from "../utils/media";
import { ICE_SERVERS, AUDIO_CONSTRAINTS, CHIME_ENDPOINT } from "../config";
import { handleWsMessage } from "../signaling";
import { useRemoteAudioSync } from "../hooks/useRemoteAudioSync";
import "./DoorbellModal.css";
import DoorbellStatus from "./DoorbellStatus.tsx";
import DoorbellControls from "./DoorbellControls.tsx";

export default function DoorbellModal() {
    // Refs
    const wsRef = useRef<WebSocket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

    // Hub->Door Audio
    const micTxRef = useRef<RTCRtpTransceiver | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const micTrackRef = useRef<MediaStreamTrack | null>(null);

    // Chime: pro Call nur einmal triggern
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

    // Intercom UI
    const [intercomReady, setIntercomReady] = useState(false);
    const [micOn, setMicOn] = useState(false);

    // abgeleitete UI-Flags
    const hasMicTrack = !!micTrackRef.current;
    const hasTx = !!micTxRef.current; // Transceiver vorbereitet (Fallback B)
    const canStartIntercom = !micOn && (intercomReady || hasTx || hasMicTrack);

    if (!import.meta.env.VITE_SIGNALING_WS_URL) {
        throw new Error("VITE_SIGNALING_WS_URL muss gesetzt sein!");
    }
    const WS_URL: string = import.meta.env.VITE_SIGNALING_WS_URL;

    /* -------- PeerConnection + Handler -------- */
    function closeModalAndCleanup() {
        setModalOpen(false);
        cleanup();
    }

    function wirePeerHandlers(pc: RTCPeerConnection) {
        pc.onicecandidate = (ev) => {
            if (ev.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ event: "candidate", data: ev.candidate.toJSON() }));
            }
        };
        pc.onsignalingstatechange = () => setSigState(pc.signalingState);
        pc.oniceconnectionstatechange = () => {
            const s = pc.iceConnectionState;
            setIceConn(s);
            if (s === "failed" || s === "disconnected" || s === "closed") {
                closeModalAndCleanup();
            }
        };
        pc.ontrack = (ev) => {
            const stream = ev.streams[0];
            const v = remoteVideoRef.current;
            const a = remoteAudioRef.current;
            if (v) {
                attachStream(v, stream);
                v.muted = true; // Autoplay-safe
                v.play().catch((e) => console.debug("remote video autoplay deferred:", e));
            }
            if (a) {
                attachStream(a, stream); // bleibt gemutet bis "Ton einschalten"
            }
        };
    }

    function newPeer() {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        wirePeerHandlers(pc);
        return pc;
    }

    function stopMic() {
        try {
            micStreamRef.current?.getTracks().forEach((t) => t.stop());
        } catch (e) {
            console.warn("stopMic tracks failed:", e);
        }
        micStreamRef.current = null;
        micTrackRef.current = null;
        setMicOn(false);
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
        stopMic();
        micTxRef.current = null;

        chimeTriggeredRef.current = false;

        setIntercomReady(false);
        setSoundEnabled(false);
        setRemoteMuted(false);
        setRemoteVolume(1);
        setErr(null);
    }

    /* --------- WS Message Helpers --------- */
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

    // Chime nur einmal pro Call triggern
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

    // A: Mic sofort holen & stumm anhängen (keine spätere Re-Negotiation)
    async function ensureIntercomPath(pc: RTCPeerConnection) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
            micStreamRef.current = stream;

            const track = stream.getAudioTracks()[0];
            if (!track) {
                console.warn("No audio track in eager mic stream");
                return false;
            }
            track.enabled = false; // stumm initial
            micTrackRef.current = track;

            try {
                pc.addTrack(track, stream);
                setIntercomReady(true);
                setMicOn(false);
            } catch (addErr) {
                console.error("addTrack failed:", addErr);
            }
            return true;
        } catch (gumErr) {
            console.warn("getUserMedia denied/unavailable, falling back to transceiver:", gumErr);
            return await prepareTransceiverFallback(pc);
        }
    }

    // B: Transceiver vorbereiten (später replaceTrack)
    async function prepareTransceiverFallback(pc: RTCPeerConnection) {
        try {
            let tx = pc.getTransceivers().find((t) => t.receiver?.track?.kind === "audio") || null;
            if (tx) {
                try {
                    tx.direction = "sendrecv";
                } catch (dirErr) {
                    console.warn("Setting transceiver.direction failed, try addTransceiver:", dirErr);
                    try {
                        tx = pc.addTransceiver("audio", { direction: "sendrecv" });
                    } catch (addErr) {
                        console.error("addTransceiver fallback failed:", addErr);
                    }
                }
            } else {
                try {
                    tx = pc.addTransceiver("audio", { direction: "sendrecv" });
                } catch (addErr) {
                    console.error("addTransceiver failed:", addErr);
                }
            }
            micTxRef.current = tx;
            if (tx) setIntercomReady(true); // Pfad ist verhandelt, Track kommt ggf. später
            return !!tx;
        } catch (prepErr) {
            console.error("prepare transceiver fallback failed:", prepErr);
            return false;
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

        // Guard: ignorier Offers in problematischen Zuständen (vereinfacht Glare-Handling)
        if (pc.signalingState !== "stable" && pc.signalingState !== "have-remote-offer") {
            console.warn("Ignoring offer in state:", pc.signalingState);
            return;
        }

        void triggerChimeOnce();

        setModalOpen(true);
        setErr(null);

        const okRemote = await setRemoteOffer(pc, data);
        if (!okRemote) return;

        await ensureIntercomPath(pc); // A oder Fallback
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

    /* ------------------- Bootstrap: WS + PC ------------------- */
    useEffect(() => {
        // WS
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => setWsOpen(true);
        ws.onclose = () => setWsOpen(false);
        ws.onerror = (e) => {
            console.warn("WS error:", e);
        };

        // PC
        const pc = newPeer();
        pcRef.current = pc;

        // WS-Message-Handler
        ws.onmessage = (e) => {
            handleWsMessage(e.data, {
                onOffer: handleOffer,
                onCandidate: handleCandidate,
                onBye: handleBye,
            });
        };

        // Cleanup for mount/unmount
        const beforeUnload = () => {
            try {
                ws.close();
            } catch (e) {
                console.debug("ws close on unload:", e);
            }
            try {
                pc.getSenders().forEach((s) => s.track?.stop());
                pc.close();
            } catch (e) {
                console.debug("pc close on unload:", e);
            }
        };
        window.addEventListener("beforeunload", beforeUnload);
        return () => {
            window.removeEventListener("beforeunload", beforeUnload);
            beforeUnload();
        };
    }, [WS_URL]);

    useRemoteAudioSync(remoteAudioRef, soundEnabled, remoteMuted, remoteVolume);

    /* ---------------- UI Actions ---------------- */
    // Empfang (Tür -> Hub)
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

    // Gegensprechen (Hub -> Tür)
    async function startIntercom() {
        setErr(null);

        // eager-Mic schon vorhanden → nur anschalten
        if (micTrackRef.current) {
            micTrackRef.current.enabled = true;
            setMicOn(true);
            setIntercomReady(true);
            return;
        }

        // Fallback (Transceiver vorbereitet)
        const pc = pcRef.current;
        const tx = micTxRef.current;
        if (!pc || !tx) {
            setErr("Kein Audio-Pfad verfügbar (Transceiver fehlt). Bitte erneut klingeln.");
            console.warn("startIntercom: no pc or transceiver");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
            micStreamRef.current = stream;

            const track = stream.getAudioTracks()[0];
            if (!track) {
                setErr("Kein Audiotrack verfügbar.");
                console.warn("startIntercom: no audio track");
                return;
            }

            await tx.sender.replaceTrack(track).catch((e) => {
                console.error("replaceTrack failed:", e);
                setErr(`replaceTrack fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
            });

            track.enabled = true;
            micTrackRef.current = track;
            setMicOn(true);
            setIntercomReady(true);
        } catch (ex) {
            const m = ex instanceof Error ? ex.message : String(ex);
            console.error("startIntercom (fallback) failed:", ex);
            setErr(`Gegensprechen fehlgeschlagen: ${m}`);
        }
    }

    function toggleMic() {
        const t = micTrackRef.current;
        if (!t) return;
        t.enabled = !t.enabled;
        setMicOn(t.enabled);
    }
    function pttDown() {
        const t = micTrackRef.current;
        if (!t) return;
        t.enabled = true;
        setMicOn(true);
    }
    function pttUp() {
        const t = micTrackRef.current;
        if (!t) return;
        t.enabled = false;
        setMicOn(false);
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

    // Anzeige-Strings
    const intercomText = useMemo(() => getIntercomText(intercomReady, micOn), [intercomReady, micOn]);

    /* ---------------- Render ---------------- */
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
                        hasMicTrack={!!micTrackRef.current}
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
