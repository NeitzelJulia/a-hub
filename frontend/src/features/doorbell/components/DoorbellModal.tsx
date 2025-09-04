import { useEffect, useRef, useState, useMemo } from "react";

type Signal =
    | { event: "offer"; data: RTCSessionDescriptionInit }
    | { event: "answer"; data: RTCSessionDescriptionInit }
    | { event: "candidate"; data: RTCIceCandidateInit }
    | { event: "bye" };

/* ---------- kleine Utils ---------- */
function getIntercomText(ready: boolean, on: boolean): string {
    if (!ready) return "not started";
    return on ? "mic on" : "mic off";
}

function attachStream(el: HTMLMediaElement | null, stream: MediaStream | null) {
    if (!el) return;
    el.srcObject = stream;
}

function clearStream(el: HTMLMediaElement | null) {
    if (!el) return;

    if (!el.paused) {
        try {
            el.pause();
        } catch (e) {
            console.debug("clearStream: pause() threw, continuing to clear stream", e);
        }
    }

    el.srcObject = null;

    try {
        el.removeAttribute("src");
        el.load();
    } catch (e) {
        console.debug("clearStream: load() threw", e);
    }
}
/* ------------------------------------------------------------- */

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
    const hasMicTrack = !!micTrackRef.current;
    const hasTx = !!micTxRef.current; // Transceiver vorbereitet (Fallback B)
    const canStartIntercom = !micOn && (intercomReady || hasTx || hasMicTrack);

    if (!import.meta.env.VITE_SIGNALING_WS_URL) {
        throw new Error("VITE_SIGNALING_WS_URL muss gesetzt sein!");
    }
    const WS_URL: string = import.meta.env.VITE_SIGNALING_WS_URL;

    /* -------- PeerConnection + Handler (als function declarations) -------- */
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
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        wirePeerHandlers(pc);
        return pc;
    }

    function stopMic() {
        try { micStreamRef.current?.getTracks().forEach((t) => t.stop()); }
        catch (e) { console.warn("stopMic tracks failed:", e); }
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
        try { pcRef.current?.getSenders().forEach((s) => s.track?.stop()); }
        catch (e) { console.warn("cleanup stop senders failed:", e); }
        try { pcRef.current?.close(); }
        catch (e) { console.warn("cleanup pc close failed:", e); }
        pcRef.current = newPeer(); // bereit für nächsten Call

        resetMediaEls();
        stopMic();
        micTxRef.current = null;

        setIntercomReady(false);
        setSoundEnabled(false);
        setRemoteMuted(false);
        setRemoteVolume(1);
        setErr(null);
    }

    /* --------- WS Message Helpers (klein & flach) --------- */
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

    // A: Mic sofort holen & stumm anhängen (keine spätere Re-Negotiation)
    async function ensureIntercomPath(pc: RTCPeerConnection) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
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
                    try { tx = pc.addTransceiver("audio", { direction: "sendrecv" }); }
                    catch (addErr) { console.error("addTransceiver fallback failed:", addErr); }
                }
            } else {
                try { tx = pc.addTransceiver("audio", { direction: "sendrecv" }); }
                catch (addErr) { console.error("addTransceiver failed:", addErr); }
            }
            micTxRef.current = tx;
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

        // PC
        const pc = newPeer();
        pcRef.current = pc;

        // WS-Message-Handler
        ws.onmessage = async (e) => {
            let msg: Signal | null = null;
            try {
                msg = JSON.parse(e.data) as Signal;
            } catch (parseErr) {
                console.warn("WS parse failed:", parseErr);
                return;
            }
            if (!msg) return;

            switch (msg.event) {
                case "offer":
                    await handleOffer(msg.data);
                    break;
                case "candidate":
                    await handleCandidate(msg.data);
                    break;
                case "bye":
                    handleBye();
                    break;
                case "answer":
                    break;
            }
        };

        // Cleanup for mount/unmount (StrictMode-friendly)
        const beforeUnload = () => {
            try { ws.close(); } catch (e) { console.debug("ws close on unload:", e); }
            try {
                pc.getSenders().forEach((s) => s.track?.stop());
                pc.close();
            } catch (e) { console.debug("pc close on unload:", e); }
        };
        window.addEventListener("beforeunload", beforeUnload);
        return () => {
            window.removeEventListener("beforeunload", beforeUnload);
            beforeUnload();
        };
    }, [WS_URL]);

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
            const stream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
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
        try { wsRef.current?.send(JSON.stringify({ event: "bye" })); }
        catch (e) { console.debug("send bye failed:", e); }
        closeModalAndCleanup();
    }

    // Anzeige-Strings
    const intercomText = useMemo(() => getIntercomText(intercomReady, micOn), [intercomReady, micOn]);

    /* ---------------- Render ---------------- */
    return (
        <div>
            {/* Debug/Status */}
            <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.5 }}>
                <div>WS: <strong>{wsOpen ? "connected" : "disconnected"}</strong></div>
                <div>Signaling: <strong>{sigState}</strong></div>
                <div>ICE: <strong>{iceConn}</strong></div>
                <div>Modal: <strong>{modalOpen ? "open" : "closed"}</strong></div>
                <div>Intercom: <strong>{intercomText}</strong></div>
            </div>

            {err && <div style={{ color: "#f66", fontFamily: "monospace", fontSize: 12 }}>{err}</div>}

            {/* Modal */}
            {modalOpen && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
                    display: "grid", placeItems: "center", zIndex: 9999
                }}>
                    <div style={{
                        width: "min(92vw, 900px)", background: "#121212", color: "#eee",
                        borderRadius: 12, padding: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.4)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <h3 style={{ margin: 0 }}>Klingel</h3>
                            <button onClick={hangup} title="Auflegen">✖</button>
                        </div>

                        <div style={{ aspectRatio: "16 / 9", background: "#000", borderRadius: 8, overflow: "hidden" }}>
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                        </div>

                        {/* Unsichtbares Audio für Tür->Hub Ton */}
                        <audio ref={remoteAudioRef} autoPlay muted />

                        {/* Controls */}
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                            {/* Tür -> Hub */}
                            <button onClick={enableSound} disabled={soundEnabled}>Ton einschalten</button>
                            <button onClick={toggleRemoteMute}>{remoteMuted ? "Unmute" : "Mute"}</button>
                            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                Vol <input
                                    type="range"
                                    min={0} max={1} step={0.05}
                                    value={remoteVolume}
                                    onChange={(e) => changeRemoteVolume(parseFloat(e.target.value))}
                                    style={{ width: 140 }}
                                />
                            </label>

                            {/* Hub -> Tür (Gegensprechen) */}
                            <div style={{ width: 1, height: 24, background: "#333", marginInline: 6 }} />
                            <button onClick={startIntercom} disabled={!canStartIntercom}>
                                Gegensprechen starten
                            </button>

                            <button onClick={toggleMic} disabled={!hasMicTrack}>
                                {micOn ? "Mic Off" : "Mic On"}
                            </button>

                            <button
                                onMouseDown={pttDown}
                                onMouseUp={pttUp}
                                onTouchStart={pttDown}
                                onTouchEnd={pttUp}
                                disabled={!hasMicTrack}
                                title="Gedrückt halten zum Sprechen"
                            >
                                Push-to-Talk
                            </button>

                            <div style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 12 }}>
                                ICE: {iceConn}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
