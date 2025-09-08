import { useEffect, type RefObject } from "react";
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
    useEffect(() => {
        // 1) PeerConnection zuerst
        const pc = h.newPeer();
        pcRef.current = pc;

        // 2) WebSocket
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        let disposed = false;

        // 3) Handler
        ws.onmessage = (e) => {
            handleWsMessage(e.data, {
                onOffer: h.onOffer,
                onCandidate: h.onCandidate,
                onBye: h.onBye,
            });
        };
        ws.onopen = () => h.setWsOpen(true);
        ws.onclose = () => h.setWsOpen(false);
        ws.onerror = (e) => {
            if (!disposed && ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
                console.warn("[WS] error:", e);
            }
        };

        // Cleanup (nur aus dem Effect heraus)
        return () => {
            disposed = true;

            // Handler lösen
            ws.onopen = ws.onclose = ws.onerror = ws.onmessage = null;

            // Tracks stoppen
            for (const s of pc.getSenders()) {
                try { s.track?.stop(); } catch (err) { console.debug("stop sender track failed:", err); }
            }

            // PC schließen
            try {
                if (pc.connectionState !== "closed") pc.close();
            } catch (err) {
                console.debug("pc.close() failed:", err);
            }

            // WICHTIG: NICHT im CONNECTING-State schließen (vermeidet Konsolen-Lärm)
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CLOSING) {
                try { ws.close(); } catch (err) { console.debug("ws.close() failed:", err); }
            }

            // Refs leeren & UI-Flag zurücksetzen
            wsRef.current = null;
            pcRef.current = null;
            h.setWsOpen(false);
        };
    }, [wsUrl]);
}
