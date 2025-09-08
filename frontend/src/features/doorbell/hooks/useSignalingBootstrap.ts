import { useEffect, useRef, type RefObject } from "react";
import { handleWsMessage } from "../signaling";

export type SignalingHandlers = Readonly<{
    setWsOpen: (v: boolean) => void;
    newPeer: () => RTCPeerConnection;

    onOffer: (data: RTCSessionDescriptionInit) => Promise<void> | void;
    onCandidate: (data: RTCIceCandidateInit) => Promise<void> | void;
    onBye: () => void;
}>;

export function useSignalingBootstrap(
    wsUrl: string,
    wsRef: RefObject<WebSocket | null>,
    pcRef: RefObject<RTCPeerConnection | null>,
    h: SignalingHandlers
) {
    const handlersRef = useRef<SignalingHandlers | null>(null);
    handlersRef.current = h;

    useEffect(() => {
        // 1) PeerConnection zuerst
        const pc = h.newPeer();
        pcRef.current = pc;

        // 2) WebSocket verbinden
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        // 3) Events genau einmal registrieren; Handler kommen aus handlersRef
        ws.onmessage = (e) => {
            const hr = handlersRef.current;
            if (!hr) return;
            handleWsMessage(e.data, {
                onOffer: hr.onOffer,
                onCandidate: hr.onCandidate,
                onBye: hr.onBye,
            });
        };

        ws.onopen = () => handlersRef.current?.setWsOpen(true);
        ws.onclose = () => handlersRef.current?.setWsOpen(false);
        ws.onerror = (e) => {
            if (ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
                console.warn("[WS] error:", e);
            }
        };

        // Cleanup
        return () => {
            // Events lösen
            ws.onopen = null;
            ws.onclose = null;
            ws.onerror = null;
            ws.onmessage = null;

            // PC sauber schließen
            try {
                pc.getSenders().forEach((s) => s.track?.stop());
            } catch (err) {
                console.warn("cleanup stop senders failed:", err);
            }
            if (pc.connectionState !== "closed") {
                try {
                    pc.close();
                } catch (err) {
                    console.warn("cleanup pc close failed:", err);
                }
            }

            // WS nur schließen, wenn sinnvoll
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CLOSING) {
                try {
                    ws.close();
                } catch (err) {
                    console.warn("cleanup ws close failed:", err);
                }
            }

            wsRef.current = null;
            pcRef.current = null;
        };
    }, [wsUrl]);
}
