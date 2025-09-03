import { useEffect, useRef, useState } from "react";

type Signal =
    | { event: "offer"; data: RTCSessionDescriptionInit }
    | { event: "answer"; data: RTCSessionDescriptionInit }
    | { event: "candidate"; data: RTCIceCandidateInit }
    | { event: "bye" };

export default function DoorbellModal() {
    // Refs
    const wsRef = useRef<WebSocket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

    // Für Hub->Door Audio
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

    if (!import.meta.env.VITE_SIGNALING_WS_URL) {
        throw new Error("VITE_SIGNALING_WS_URL muss gesetzt sein!");
    }
    const WS_URL: string = import.meta.env.VITE_SIGNALING_WS_URL;

    // Helpers
    const wirePeerHandlers = (pc: RTCPeerConnection) => {
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
                v.srcObject = stream;
                v.muted = true; // Autoplay-safe
                v.play().catch((e) => console.debug("video autoplay deferred:", e));
            }
            if (a) {
                a.srcObject = stream;
            }
        };
    };

    const newPeer = () => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        wirePeerHandlers(pc);
        return pc;
    };

    const stopMic = () => {
        try {
            micStreamRef.current?.getTracks().forEach((t) => t.stop());
        } catch (e) {
            console.warn("stopMic tracks failed:", e);
        }
        micStreamRef.current = null;
        micTrackRef.current = null;
        setMicOn(false);
    };

    const cleanup = () => {
        // Tracks schließen
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
        pcRef.current = newPeer();

        // Media-Elemente räumen
        const v = remoteVideoRef.current;
        if (v) {
            try { v.pause(); } catch (e) { console.debug("video pause:", e); }
            v.srcObject = null;
        }
        const a = remoteAudioRef.current;
        if (a) {
            try { a.pause(); } catch (e) { console.debug("audio pause:", e); }
            a.srcObject = null;
            a.muted = true;
            a.volume = 1;
        }

        // Intercom
        stopMic();
        micTxRef.current = null;
        setIntercomReady(false);

        // UI
        setSoundEnabled(false);
        setRemoteMuted(false);
        setRemoteVolume(1);
        setErr(null);
    };

    const closeModalAndCleanup = () => {
        setModalOpen(false);
        cleanup();
    };

    // Bootstrap: WS + PC
    useEffect(() => {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => setWsOpen(true);
        ws.onclose = () => setWsOpen(false);

        const pc = newPeer();
        pcRef.current = pc;

        ws.onmessage = async (e) => {
            const msg = JSON.parse(e.data) as Signal;
            const currentPc = pcRef.current;
            if (!currentPc) return;

            if (msg.event === "offer") {
                setModalOpen(true);
                setErr(null);

                try {
                    // Remote Offer setzen
                    await currentPc.setRemoteDescription(new RTCSessionDescription(msg.data));
                } catch (ex) {
                    const m = ex instanceof Error ? ex.message : String(ex);
                    console.error("setRemoteDescription(offer) failed:", ex);
                    setErr(`Offer konnte nicht gesetzt werden: ${m}`);
                    return;
                }

                let eagerMicOk = false;
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: false,
                        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                    });
                    micStreamRef.current = stream;

                    const track = stream.getAudioTracks()[0];
                    if (track) {
                        track.enabled = false;
                        micTrackRef.current = track;

                        try {
                            currentPc.addTrack(track, stream);
                            eagerMicOk = true;
                            setIntercomReady(true);
                            setMicOn(false);
                        } catch (addErr) {
                            console.error("addTrack failed:", addErr);
                        }
                    } else {
                        console.warn("No audio track in eager mic stream");
                    }
                } catch (gumErr) {
                    console.warn("getUserMedia (mic) denied/unavailable, using transceiver fallback:", gumErr);

                    try {
                        let tx =
                            currentPc
                                .getTransceivers()
                                .find((t) => t.receiver?.track?.kind === "audio") || null;

                        if (tx) {
                            try {
                                tx.direction = "sendrecv";
                            } catch (dirErr) {
                                console.warn("Setting transceiver.direction failed, try addTransceiver:", dirErr);
                                try {
                                    tx = currentPc.addTransceiver("audio", { direction: "sendrecv" });
                                } catch (addErr) {
                                    console.error("addTransceiver fallback failed:", addErr);
                                }
                            }
                        } else {
                            try {
                                tx = currentPc.addTransceiver("audio", { direction: "sendrecv" });
                            } catch (addErr) {
                                console.error("addTransceiver failed:", addErr);
                            }
                        }
                        micTxRef.current = tx;
                    } catch (prepErr) {
                        console.error("prepare transceiver fallback failed:", prepErr);
                    }
                }

                // Answer bauen & senden
                try {
                    const answer = await currentPc.createAnswer();
                    await currentPc.setLocalDescription(answer);
                    wsRef.current?.send(JSON.stringify({ event: "answer", data: answer }));
                } catch (ex) {
                    const m = ex instanceof Error ? ex.message : String(ex);
                    console.error("Answering failed:", ex);
                    setErr(`Answer fehlgeschlagen: ${m}`);
                    return;
                }

                // Debug-Ausgabe
                if (eagerMicOk) {
                    const senders = currentPc.getSenders().map((s) => s.track?.kind || "none");
                    console.debug("Senders after eager mic:", senders);
                } else if (micTxRef.current) {
                    console.debug("Transceiver fallback prepared:", micTxRef.current.direction);
                }
            } else if (msg.event === "candidate") {
                try {
                    await currentPc.addIceCandidate(new RTCIceCandidate(msg.data));
                } catch (ex) {
                    console.warn("addIceCandidate (hub) failed:", ex);
                }
            } else if (msg.event === "bye") {
                closeModalAndCleanup();
            }
        };

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

    // Empfang (Tür -> Hub)
    const enableSound = async () => {
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
    };
    const toggleRemoteMute = () => {
        const a = remoteAudioRef.current;
        if (!a) return;
        a.muted = !a.muted;
        setRemoteMuted(a.muted);
    };
    const changeRemoteVolume = (v: number) => {
        const a = remoteAudioRef.current;
        if (!a) return;
        a.volume = v;
        setRemoteVolume(v);
    };

    // Gegensprechen (Hub -> Tür)
    const startIntercom = async () => {
        setErr(null);
        // Falls eager-Mic schon hängt: nur UI updaten
        if (micTrackRef.current) {
            // schon verhandelt + Track vorhanden, nur noch anschalten
            micTrackRef.current.enabled = true;
            setMicOn(true);
            setIntercomReady(true);
            return;
        }

        // Fallback-Pfad
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
    };

    const toggleMic = () => {
        const t = micTrackRef.current;
        if (!t) return;
        t.enabled = !t.enabled;
        setMicOn(t.enabled);
    };

    const pttDown = () => {
        const t = micTrackRef.current;
        if (!t) return;
        t.enabled = true;
        setMicOn(true);
    };
    const pttUp = () => {
        const t = micTrackRef.current;
        if (!t) return;
        t.enabled = false;
        setMicOn(false);
    };

    const hangup = () => {
        try {
            wsRef.current?.send(JSON.stringify({ event: "bye" }));
        } catch (e) {
            console.debug("send bye failed:", e);
        }
        closeModalAndCleanup();
    };

    // UI
    return (
        <div>
            {/* Debug/Status */}
            <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.5 }}>
                <div>WS: <strong>{wsOpen ? "connected" : "disconnected"}</strong></div>
                <div>Signaling: <strong>{sigState}</strong></div>
                <div>ICE: <strong>{iceConn}</strong></div>
                <div>Modal: <strong>{modalOpen ? "open" : "closed"}</strong></div>
                <div>Intercom: <strong>{intercomReady ? (micOn ? "mic on" : "mic off") : "not started"}</strong></div>
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
                        <audio ref={remoteAudioRef} autoPlay playsInline muted />

                        {/* Controls */}
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                            {/* Tür -> Hub */}
                            <button onClick={enableSound} disabled={soundEnabled}>Ton einschalten</button>
                            <button onClick={toggleRemoteMute}>{remoteMuted ? "Unmute" : "Mute"}</button>
                            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                Vol
                                <input
                                    type="range"
                                    min={0} max={1} step={0.05}
                                    value={remoteVolume}
                                    onChange={(e) => changeRemoteVolume(parseFloat(e.target.value))}
                                    style={{ width: 140 }}
                                />
                            </label>

                            {/* Hub -> Tür (Gegensprechen) */}
                            <div style={{ width: 1, height: 24, background: "#333", marginInline: 6 }} />
                            <button onClick={startIntercom} disabled={intercomReady}>Gegensprechen starten</button>
                            <button onClick={toggleMic} disabled={!intercomReady}>
                                {micOn ? "Mic Off" : "Mic On"}
                            </button>
                            <button
                                onMouseDown={pttDown}
                                onMouseUp={pttUp}
                                onTouchStart={pttDown}
                                onTouchEnd={pttUp}
                                disabled={!intercomReady}
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
