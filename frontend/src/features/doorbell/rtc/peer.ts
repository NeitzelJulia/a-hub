import type { RefObject } from "react";

type MakeNewPeerArgs = {
    wsRef: RefObject<WebSocket | null>;
    iceServers: RTCIceServer[];
    onSig: (s: RTCSignalingState) => void;
    onIce: (s: RTCIceConnectionState) => void;
    onStream: (stream: MediaStream) => void;
};

export function makeNewPeer({
                                wsRef,
                                iceServers,
                                onSig,
                                onIce,
                                onStream,
                            }: MakeNewPeerArgs) {
    return () => {
        const pc = new RTCPeerConnection({ iceServers });

        pc.onicecandidate = (ev) => {
            if (!ev.candidate) return;
            const ws = wsRef.current;
            if (ws?.readyState === WebSocket.OPEN) {
                ws.send(
                    JSON.stringify({ event: "candidate", data: ev.candidate.toJSON() })
                );
            }
        };

        pc.onsignalingstatechange = () => {
            onSig(pc.signalingState);
        };

        pc.oniceconnectionstatechange = () => {
            onIce(pc.iceConnectionState);
        };

        pc.ontrack = (ev) => {
            const stream = ev.streams[0];
            if (stream) onStream(stream);
        };

        return pc;
    };
}
