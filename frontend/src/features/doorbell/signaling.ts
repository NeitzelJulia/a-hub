export type Signal =
    | { event: "offer"; data: RTCSessionDescriptionInit }
    | { event: "answer"; data: RTCSessionDescriptionInit }
    | { event: "candidate"; data: RTCIceCandidateInit }
    | { event: "bye" };

type Handlers = Readonly<{
    onOffer: (data: RTCSessionDescriptionInit) => Promise<void> | void;
    onCandidate: (data: RTCIceCandidateInit) => Promise<void> | void;
    onBye: () => void;
    // 'answer' wird hier bewusst ignoriert (Hub sendet nur)
}>;

export function handleWsMessage(raw: string, h: Handlers): void {
    let msg: Signal | null = null;
    try {
        msg = JSON.parse(raw) as Signal;
    } catch (parseErr) {
        console.warn("WS parse failed:", parseErr);
        return;
    }
    if (!msg) return;

    switch (msg.event) {
        case "offer":
            h.onOffer(msg.data);
            break;
        case "candidate":
            h.onCandidate(msg.data);
            break;
        case "bye":
            h.onBye();
            break;
        case "answer":
            // ignored intentionally on hub
            break;
    }
}