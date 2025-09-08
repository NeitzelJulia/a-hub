export async function setRemoteOfferSafe(
    pc: RTCPeerConnection,
    data: RTCSessionDescriptionInit
): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        return { ok: true };
    } catch (ex) {
        const error = ex instanceof Error ? ex.message : String(ex);
        return { ok: false, error };
    }
}

export async function sendAnswerSafe(
    pc: RTCPeerConnection,
    ws: WebSocket | null
): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws?.send(JSON.stringify({ event: "answer", data: answer }));
        return { ok: true };
    } catch (ex) {
        const error = ex instanceof Error ? ex.message : String(ex);
        return { ok: false, error };
    }
}
