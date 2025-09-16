export const HISTORY_REFRESH = "doorbell-history:refresh";

export function emitHistoryRefresh() {
    window.dispatchEvent(new Event(HISTORY_REFRESH));
}

export function onHistoryRefresh(cb: () => void): () => void {
    const handler = () => cb();
    window.addEventListener(HISTORY_REFRESH, handler);
    return () => window.removeEventListener(HISTORY_REFRESH, handler);
}
