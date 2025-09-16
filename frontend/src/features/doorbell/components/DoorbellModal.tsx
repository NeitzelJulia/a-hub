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
import { useDoorbellHistoryLifecycle } from "../hooks/useDoorbellHistoryLifecycle";
import "./DoorbellModal.css";
import DoorbellStatus from "./DoorbellStatus.tsx";
import DoorbellControls from "./DoorbellControls.tsx";

const BAD_ICE = new Set<RTCIceConnectionState>(["failed", "disconnected", "closed"]);
const INACTIVITY_MS = 15000;

export default function DoorbellModal() {
    // Refs
    const wsRef = useRef<WebSocket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const chimeTriggeredRef = useRef<boolean>(false);

    // Interaktions-/Timer-Refs
    const interactedRef = useRef<boolean>(false);
    const inactivityTimerRef = useRef<number | null>(null);

    // State
    const [wsOpen, setWsOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [audible, setAudible] = useState(false);
    const [remoteVolume, setRemoteVolume] = useState(1);
    const [sigState, setSigState] = useState<RTCSignalingState>("stable");
    const [iceConn, setIceConn] = useState<RTCIceConnectionState>("new");
    const [err, setErr] = useState<string | null>(null);

    if (!import.meta.env.VITE_SIGNALING_WS_URL) {
        throw new Error("VITE_SIGNALING_WS_URL muss gesetzt sein!");
    }
    const WS_URL: string = import.meta.env.VITE_SIGNALING_WS_URL;

    // DB-History Lifecycle
    const { onCallStart, onAnswered, startTalk, onCallEnd } = useDoorbellHistoryLifecycle();

    // Inaktivitäts-Timer
    const clearInactivity = useCallback(() => {
        if (inactivityTimerRef.current !== null) {
            window.clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }
    }, []);

    const startInactivity = useCallback(() => {
        clearInactivity();
        inactivityTimerRef.current = window.setTimeout(() => {
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(JSON.stringify({ event: "bye" }));
                } catch (e) {
                    console.debug("auto-close: send bye failed:", e);
                }
            }
            closeModalAndCleanup();
            void onCallEnd();
        }, INACTIVITY_MS);
    }, [clearInactivity, onCallEnd]);

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
        clearInactivity();

        try {
            const pc = pcRef.current;
            if (pc) {
                try {
                    pc.getSenders().forEach((s) => {
                        const tr = s.track;
                        if (tr && typeof tr.stop === "function") tr.stop();
                    });
                } catch (e) {
                    console.warn("cleanup stop senders failed:", e);
                }
                try {
                    pc.close();
                } catch (e) {
                    console.warn("cleanup pc close failed:", e);
                }
            }
        } catch (e) {
            console.warn("cleanup pc wrapper failed:", e);
        }

        pcRef.current = newPeer(); // bereit für nächsten Call
        resetMediaEls();
        resetIntercom();
        chimeTriggeredRef.current = false;

        setAudible(false);
        setRemoteVolume(1);
        setErr(null);
        interactedRef.current = false;
    }, [newPeer, resetMediaEls, resetIntercom, clearInactivity]);

    const closeModalAndCleanup = useCallback(() => {
        setModalOpen(false);
        cleanup();
    }, [cleanup]);

    // Schlechte ICE-States -> als Auto-Close behandeln
    useEffect(() => {
        if (BAD_ICE.has(iceConn)) {
            // wie Auto-Close: Peer per bye informieren, Call enden
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(JSON.stringify({ event: "bye" }));
                } catch (e) {
                    console.debug("bad-ice: send bye failed:", e);
                }
            }
            closeModalAndCleanup();
            void onCallEnd();
        }
    }, [iceConn, closeModalAndCleanup, onCallEnd]);

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
            interactedRef.current = false;
            startInactivity();
            void triggerChimeOnce(chimeTriggeredRef, CHIME_ENDPOINT);

            // DB: Event anlegen
            void onCallStart();

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
        [prepareForCall, onCallStart, startInactivity]
    );

    const handleCandidate = useCallback(async (data: RTCIceCandidateInit) => {
        const pc = pcRef.current;
        if (!pc) return;
        const res = await addCandidateSafe(pc, data);
        if (!res.ok) {
            console.warn("addIceCandidate (hub) failed:", res.error);
        }
    }, []);

    // Remote-Bye -> lokal beenden (nicht als answered markieren, falls keine Interaktion)
    const handleBye = useCallback(() => {
        closeModalAndCleanup();
        void onCallEnd();
    }, [closeModalAndCleanup, onCallEnd]);

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

    // Audio-Ref syncen (setzt nur muted/volume; kein play() hier)
    useRemoteAudioSync(remoteAudioRef, audible, remoteVolume);

    // UI-Actions
    const toggleAudible = useCallback(async () => {
        const a = remoteAudioRef.current;
        if (!a) return;

        if (audible) {
            // -> Mute
            setAudible(false);
            return;
        }

        // -> Unmute & (erstmals) abspielen
        try {
            a.muted = false;
            await a.play();
            setAudible(true);

            // Interaktion -> answered + Timer stoppen
            if (!interactedRef.current) {
                interactedRef.current = true;
                clearInactivity();
                void onAnswered();
            }
            // Talkzeit erst mit hörbarem Ton zählen
            startTalk();
        } catch (ex) {
            const m = ex instanceof Error ? ex.message : String(ex);
            console.warn("audio play failed:", ex);
            setErr(`Audio konnte nicht gestartet werden: ${m}`);
            a.muted = true; // zurückrollen
        }
    }, [audible, onAnswered, startTalk, clearInactivity]);

    const changeRemoteVolume = useCallback((v: number) => {
        const a = remoteAudioRef.current;
        if (!a) return;
        a.volume = v;
        setRemoteVolume(v);
    }, []);

    const handleMicToggle = useCallback(async () => {
        if (!hasMicTrack) {
            await startIntercom();
            // Interaktion -> answered + Timer stoppen
            if (!interactedRef.current) {
                interactedRef.current = true;
                clearInactivity();
                void onAnswered();
            }
        } else {
            toggleMic();
        }
    }, [hasMicTrack, startIntercom, toggleMic, onAnswered, clearInactivity]);

    // Manuelles Schließen = Interaktion -> answered (falls noch nicht), dann finish
    const hangup = useCallback(() => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ event: "bye" }));
            } catch (e) {
                console.debug("send bye failed:", e);
            }
        }

        if (!interactedRef.current) {
            interactedRef.current = true;
            void onAnswered();
        }

        closeModalAndCleanup();
        void onCallEnd();
    }, [closeModalAndCleanup, onAnswered, onCallEnd]);

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
                        audible={audible}
                        remoteVolume={remoteVolume}
                        micOn={micOn}
                        hasMicTrack={hasMicTrack}
                        onToggleAudible={toggleAudible}
                        onChangeRemoteVolume={changeRemoteVolume}
                        onToggleMic={handleMicToggle}
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
