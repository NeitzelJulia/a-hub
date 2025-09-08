export async function addCandidateSafe(
    pc: RTCPeerConnection,
    data: RTCIceCandidateInit
): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        await pc.addIceCandidate(new RTCIceCandidate(data));
        return { ok: true };
    } catch (ex) {
        const msg = ex instanceof Error ? ex.message : String(ex);
        return { ok: false, error: msg };
    }
}
