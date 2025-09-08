type BoolRef = { current: boolean };

export async function triggerChimeOnce(
    chimeTriggeredRef: BoolRef,
    endpoint: string
): Promise<void> {
    if (chimeTriggeredRef.current) return;
    chimeTriggeredRef.current = true;

    try {
        const resp = await fetch(endpoint, { method: "POST" });
        if (!resp.ok) {
            const text = await resp.text().catch(() => "");
            console.warn("Chime trigger failed:", resp.status, text);
        }
    } catch (e) {
        console.warn("Chime trigger error:", e);
    }
}
