import { useCallback, useMemo, useRef, useState, type RefObject } from "react";

export type IntercomApi = {
    intercomReady: boolean;
    micOn: boolean;
    hasMicTrack: boolean;
    canStartIntercom: boolean;

    prepareForCall: () => Promise<void>;   // vor dem Answer einmal aufrufen
    startIntercom: () => Promise<void>;
    toggleMic: () => void;
    pttDown: () => void;
    pttUp: () => void;
    reset: () => void;                     // für cleanup()
};

type Args = {
    pcRef: RefObject<RTCPeerConnection | null>;
    audioConstraints: MediaStreamConstraints;
    onError?: (msg: string) => void;
};

export function useIntercom({ pcRef, audioConstraints, onError }: Args): IntercomApi {
    const micTxRef = useRef<RTCRtpTransceiver | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const micTrackRef = useRef<MediaStreamTrack | null>(null);

    const [intercomReady, setIntercomReady] = useState(false);
    const [micOn, setMicOn] = useState(false);

    const hasMicTrack = !!micTrackRef.current;
    const hasTx = !!micTxRef.current;
    const canStartIntercom = useMemo(
        () => !micOn && (intercomReady || hasTx || hasMicTrack),
        [micOn, intercomReady, hasTx, hasMicTrack]
    );

    const reset = useCallback(() => {
        try {
            micStreamRef.current?.getTracks().forEach((t) => t.stop());
        } catch (e) {
            console.warn("intercom reset: stop tracks failed:", e);
        }
        micStreamRef.current = null;
        micTrackRef.current = null;
        micTxRef.current = null;
        setIntercomReady(false);
        setMicOn(false);
    }, []);

    const prepareTransceiverFallback = useCallback((pc: RTCPeerConnection) => {
        try {
            let tx = pc.getTransceivers().find((t) => t.receiver?.track?.kind === "audio") || null;
            if (tx) {
                try {
                    tx.direction = "sendrecv";
                } catch (e) {
                    console.warn("set transceiver.direction failed, adding new:", e);
                    tx = pc.addTransceiver("audio", { direction: "sendrecv" });
                }
            } else {
                tx = pc.addTransceiver("audio", { direction: "sendrecv" });
            }
            micTxRef.current = tx;
            setIntercomReady(true);
        } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            console.error("prepare transceiver fallback failed:", e);
            onError?.(`Transceiver-Setup fehlgeschlagen: ${m}`);
            throw e;
        }
    }, [onError]);

    const prepareForCall = useCallback(async () => {
        const pc = pcRef.current;
        if (!pc) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
            micStreamRef.current = stream;

            const track = stream.getAudioTracks()[0];
            if (!track) {
                onError?.("Kein Audio-Track verfügbar.");
                return;
            }
            track.enabled = false;
            micTrackRef.current = track;

            try {
                pc.addTrack(track, stream);
            } catch (e) {
                console.warn("addTrack failed, fallback to transceiver:", e);
                prepareTransceiverFallback(pc);
            }
            setIntercomReady(true);
            setMicOn(false);
        } catch (gumErr) {
            console.warn("getUserMedia denied/unavailable, fallback to transceiver:", gumErr);
            const pc2 = pcRef.current;
            if (pc2) prepareTransceiverFallback(pc2);
        }
    }, [pcRef, audioConstraints, onError, prepareTransceiverFallback]);

    const startIntercom = useCallback(async () => {
        const pc = pcRef.current;
        if (!pc) return;

        if (micTrackRef.current) {
            micTrackRef.current.enabled = true;
            setMicOn(true);
            setIntercomReady(true);
            return;
        }

        const tx = micTxRef.current;
        if (!tx) {
            onError?.("Kein Audio-Pfad verfügbar (Transceiver fehlt). Bitte erneut klingeln.");
            console.warn("startIntercom: no transceiver");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
            micStreamRef.current = stream;

            const track = stream.getAudioTracks()[0];
            if (!track) {
                onError?.("Kein Audiotrack verfügbar.");
                return;
            }

            await tx.sender.replaceTrack(track);
            track.enabled = true;
            micTrackRef.current = track;
            setMicOn(true);
            setIntercomReady(true);
        } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            console.error("startIntercom failed:", e);
            onError?.(`Gegensprechen fehlgeschlagen: ${m}`);
        }
    }, [pcRef, audioConstraints, onError]);

    const toggleMic = useCallback(() => {
        const t = micTrackRef.current;
        if (!t) return;
        t.enabled = !t.enabled;
        setMicOn(t.enabled);
    }, []);

    const pttDown = useCallback(() => {
        const t = micTrackRef.current;
        if (!t) return;
        t.enabled = true;
        setMicOn(true);
    }, []);

    const pttUp = useCallback(() => {
        const t = micTrackRef.current;
        if (!t) return;
        t.enabled = false;
        setMicOn(false);
    }, []);

    return {
        intercomReady,
        micOn,
        hasMicTrack,
        canStartIntercom,
        prepareForCall,
        startIntercom,
        toggleMic,
        pttDown,
        pttUp,
        reset,
    };
}
