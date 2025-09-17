import { useCallback, useRef } from "react";

type CreateResp = { id: number; occurredAtMillis: number };

const BASE = "/api/history/events";

export function useDoorbellHistoryLifecycle() {
    const currentIdRef = useRef<number | null>(null);
    const answeredRef = useRef<boolean>(false);
    const sendingAnsweredRef = useRef<boolean>(false);
    const talkStartRef = useRef<number | null>(null);

    const dispatchRefresh = () =>
        window.dispatchEvent(new CustomEvent("doorbell-history:refresh"));

    const onCallStart = useCallback(async () => {
        if (currentIdRef.current != null) return;
        try {
            const resp = await fetch(`${BASE}`, { method: "POST" });
            if (!resp.ok) {
                console.warn("create event failed:", resp.status);
                return;
            }
            const json = (await resp.json()) as CreateResp;
            currentIdRef.current = json.id ?? null;
            answeredRef.current = false;
            talkStartRef.current = null;
            dispatchRefresh();
        } catch (e) {
            console.warn("create event error:", e);
        }
    }, []);

    const onAnswered = useCallback(async () => {
        const id = currentIdRef.current;
        if (id == null) return;
        if (answeredRef.current) return;
        if (sendingAnsweredRef.current) return;

        sendingAnsweredRef.current = true;
        try {
            const resp = await fetch(`${BASE}/${id}/answered`, { method: "PATCH" });
            if (resp.ok || resp.status === 204) {
                answeredRef.current = true;
                dispatchRefresh();
            } else {
                console.warn("answered failed:", resp.status);
            }
        } catch (e) {
            console.warn("answered error:", e);
        } finally {
            sendingAnsweredRef.current = false;
        }
    }, []);

    const startTalk = useCallback(() => {
        talkStartRef.current = Date.now();
    }, []);

    const onCallEnd = useCallback(async () => {
        const id = currentIdRef.current;
        const start = talkStartRef.current;

        currentIdRef.current = null;
        talkStartRef.current = null;
        sendingAnsweredRef.current = false;

        const seconds =
            start != null ? Math.max(0, Math.round((Date.now() - start) / 1000)) : 0;

        if (id == null) return;

        try {
            const resp = await fetch(`${BASE}/${id}/finish`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ talkSeconds: seconds }),
            });
            if (resp.ok || resp.status === 204) {
                dispatchRefresh();
            } else {
                console.warn("finish failed:", resp.status);
            }
        } catch (e) {
            console.warn("finish error:", e);
        } finally {
            answeredRef.current = false;
        }
    }, []);

    return { onCallStart, onAnswered, startTalk, onCallEnd };
}
