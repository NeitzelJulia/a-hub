import { useEffect, useRef, useState } from "react";

type Signal =
    | { event: "offer"; data: RTCSessionDescriptionInit }
    | { event: "answer"; data: RTCSessionDescriptionInit }
    | { event: "candidate"; data: RTCIceCandidateInit };

export default function WebRTCClient() {
    const wsRef = useRef<WebSocket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);

    // Status
    const [wsOpen, setWsOpen] = useState(false);
    const [sigState, setSigState] = useState<RTCSignalingState>("stable");
    const [iceConn, setIceConn] = useState<RTCIceConnectionState>("new");
    const [iceGather, setIceGather] = useState<RTCIceGatheringState>("new");

    // DataChannel
    const dcRef = useRef<RTCDataChannel | null>(null);
    const [dcOpen, setDcOpen] = useState(false);
    const [msgs, setMsgs] = useState<string[]>([]);

    // A/V
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const [avReady, setAvReady] = useState(false);
    const [avError, setAvError] = useState<string | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [tracksInfo, setTracksInfo] = useState({ senders: 0, gotOnTrack: 0 });

    // Mic / Remote Audio Steuerung
    const [micOn, setMicOn] = useState(true);
    const [remoteMuted, setRemoteMuted] = useState(false);
    const [remoteVolume, setRemoteVolume] = useState(1);

    const getLocalAudioTrack = () =>
        localStreamRef.current?.getAudioTracks?.()[0] ?? null;

    // WS-URL
    if (!import.meta.env.VITE_SIGNALING_WS_URL) {
        throw new Error("VITE_SIGNALING_WS_URL muss gesetzt sein!");
    }
    const WS_URL: string = import.meta.env.VITE_SIGNALING_WS_URL;


    useEffect(() => {
        // 1) WebSocket verbinden
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => setWsOpen(true);
        ws.onclose = () => setWsOpen(false);

        const beforeUnload = () => { try { ws.close(); } catch {/* noop: ws already closed */} };
        window.addEventListener("beforeunload", beforeUnload);

        // 2) PeerConnection
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcRef.current = pc;

        // Status
        pc.onsignalingstatechange = () => setSigState(pc.signalingState);
        pc.oniceconnectionstatechange = () => setIceConn(pc.iceConnectionState);
        pc.onicegatheringstatechange = () => setIceGather(pc.iceGatheringState);

        // ICE-Kandidaten senden
        pc.onicecandidate = (ev) => {
            if (ev.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ event: "candidate", data: ev.candidate.toJSON() }));
            }
        };

        // Remote-Track (Video + Audio)
        pc.ontrack = (ev) => {
            setTracksInfo((t) => ({ ...t, gotOnTrack: t.gotOnTrack + 1 }));
            const stream = ev.streams[0];
            const remoteEl = remoteVideoRef.current;
            const remoteAudioEl = remoteAudioRef.current;

            if (remoteEl) {
                remoteEl.srcObject = stream;
                remoteEl.muted = true; // Video bleibt gemuted -> Autoplay klappt
                remoteEl.play().catch(() => {});
            }
            if (remoteAudioEl) {
                remoteAudioEl.srcObject = stream;
            }
        };

        // DataChannel (Initiator + Responder)
        const dc = pc.createDataChannel("test");
        dcRef.current = dc;
        dc.onopen = () => setDcOpen(true);
        dc.onclose = () => setDcOpen(false);
        dc.onmessage = (e) => setMsgs((m) => [...m, `RX: ${e.data}`]);

        pc.ondatachannel = (ev) => {
            const ch = ev.channel;
            dcRef.current = ch;
            ch.onopen = () => setDcOpen(true);
            ch.onclose = () => setDcOpen(false);
            ch.onmessage = (e) => setMsgs((m) => [...m, `RX: ${e.data}`]);
        };

        // Signale empfangen
        ws.onmessage = async (e) => {
            const msg = JSON.parse(e.data) as Signal;
            if (!pcRef.current) return;

            if (msg.event === "offer") {
                await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.data));
                const answer = await pcRef.current.createAnswer();
                await pcRef.current.setLocalDescription(answer);
                wsRef.current?.send(JSON.stringify({ event: "answer", data: answer }));
            } else if (msg.event === "answer") {
                if (!pcRef.current.currentRemoteDescription) {
                    await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.data));
                }
            } else if (msg.event === "candidate") {
                try {
                    await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.data));
                } catch (err) {
                    console.error("addIceCandidate failed", err);
                }
            }
        };

        // Cleanup
        return () => {
            window.removeEventListener("beforeunload", beforeUnload);
            try { ws.close(); } catch {/* noop */}
            try {
                pc.getSenders().forEach((s) => s.track?.stop());
                pc.close();
            } catch {/* noop */}
        };
    }, [WS_URL]);

    // A/V starten
    const startAV = async () => {
        setAvError(null);
        const supported =
            typeof navigator !== "undefined" &&
            !!navigator.mediaDevices?.getUserMedia;
        if (!supported) {
            setAvError(
                window.isSecureContext
                    ? "getUserMedia wird nicht unterstützt."
                    : "getUserMedia erfordert HTTPS oder http://localhost."
            );
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });

            localStreamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                localVideoRef.current.muted = true;
                await localVideoRef.current.play().catch(() => {});
            }

            stream.getTracks().forEach((t) => pcRef.current!.addTrack(t, stream));
            setTracksInfo({ senders: pcRef.current!.getSenders().length, gotOnTrack: 0 });
            setAvReady(true);

            // Mic initial an
            const at = getLocalAudioTrack();
            if (at) { at.enabled = true; setMicOn(true); }
        } catch (err: unknown) {
            const message =
                err instanceof Error ? (err.name || err.message) : String(err);
            setAvError(`getUserMedia fehlgeschlagen: ${message}`);
        }
    };

    // Offer erstellen & senden
    const createOffer = async () => {
        if (!pcRef.current || !wsRef.current) return;
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        wsRef.current.send(JSON.stringify({ event: "offer", data: offer }));
    };

    // DataChannel-Test
    const sendPing = () => {
        if (!dcRef.current || dcRef.current.readyState !== "open") return;
        const text = `ping ${new Date().toISOString()}`;
        dcRef.current.send(text);
        setMsgs((m) => [...m, `TX: ${text}`]);
    };

    // Mic-Handler
    const toggleMic = () => {
        const t = getLocalAudioTrack();
        if (!t) return;
        t.enabled = !t.enabled;
        setMicOn(t.enabled);
    };
    const pttDown = () => {
        const t = getLocalAudioTrack();
        if (!t) return;
        t.enabled = true;
        setMicOn(true);
    };
    const pttUp = () => {
        const t = getLocalAudioTrack();
        if (!t) return;
        t.enabled = false;
        setMicOn(false);
    };

    // Remote Audio steuern
    const enableSound = async () => {
        const audioEl = remoteAudioRef.current;
        if (!audioEl) return;
        try {
            audioEl.muted = false;
            await audioEl.play();
            setSoundEnabled(true);
        } catch (e) {
            console.warn("Audio play blocked:", e);
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

    const reset = () => window.location.reload();

    return (
        <div style={{ display: "grid", gap: 12, maxWidth: 900 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", background: "#000" }} />
                <video ref={remoteVideoRef} autoPlay playsInline muted style={{ width: "100%", background: "#000" }} />
            </div>

            {/* unsichtbares Audio-Element für Remote-Ton */}
            <audio ref={remoteAudioRef} autoPlay playsInline muted />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={startAV} disabled={avReady}>Start A/V</button>
                <button onClick={createOffer} disabled={!wsOpen || !avReady}>Create Offer</button>
                <button onClick={sendPing} disabled={!dcOpen}>Send Ping</button>

                {/* Mic steuern */}
                <button onClick={toggleMic} disabled={!avReady}>
                    {micOn ? "Mic Off" : "Mic On"}
                </button>
                <button
                    onMouseDown={pttDown}
                    onMouseUp={pttUp}
                    onTouchStart={pttDown}
                    onTouchEnd={pttUp}
                    disabled={!avReady}
                    title="Gedrückt halten zum Sprechen"
                >
                    Push-to-Talk
                </button>

                {/* Remote Audio Kontrolle */}
                <button onClick={enableSound} disabled={soundEnabled}>Enable Sound</button>
                <button onClick={toggleRemoteMute}>
                    {remoteMuted ? "Unmute Remote" : "Mute Remote"}
                </button>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    Vol
                    <input
                        type="range"
                        min={0} max={1} step={0.05}
                        value={remoteVolume}
                        onChange={(e) => changeRemoteVolume(parseFloat(e.target.value))}
                        style={{ width: 120 }}
                    />
                </label>

                <button onClick={reset}>Reset</button>
            </div>

            {avError && (
                <div style={{ color: "#f88", fontFamily: "monospace", fontSize: 12 }}>
                    {avError}
                </div>
            )}

            <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.5 }}>
                <div>Origin: <strong>{location.origin}</strong></div>
                <div>SecureContext: <strong>{String(window.isSecureContext)}</strong></div>
                <div>WS: <strong>{wsOpen ? "connected" : "disconnected"}</strong></div>
                <div>SignalingState: <strong>{sigState}</strong></div>
                <div>ICE Conn: <strong>{iceConn}</strong></div>
                <div>ICE Gathering: <strong>{iceGather}</strong></div>
                <div>DataChannel: <strong>{dcOpen ? "open" : "closed"}</strong></div>
                <div>A/V: <strong>{avReady ? "ready" : "not started"}</strong> — Senders: {tracksInfo.senders}, ontrack: {tracksInfo.gotOnTrack}</div>
                <div>Mic: <strong>{micOn ? "on" : "off"}</strong></div>
                <div>Remote Vol: {Math.round(remoteVolume * 100)}%</div>
            </div>

            <div style={{ padding: 8, background: "#111", color: "#ddd", fontFamily: "monospace", fontSize: 12, borderRadius: 6 }}>
                <div style={{ marginBottom: 6 }}>Messages:</div>
                {msgs.length === 0 ? <div>—</div> :
                    msgs.map((m, i) => <div key={i}>{m}</div>)}
            </div>

            <small>WebRTC Client — Video + Audio, Mic-Steuerung, Push-to-Talk</small>
        </div>
    );
}
