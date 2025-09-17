import type { DoorbellEvent, DoorbellEventCreateResponseDto } from "../models/DoorbellEvent";

const BASE = "/api/history";

async function asJson<T>(r: Response): Promise<T> {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json() as Promise<T>;
}

export async function createEvent(): Promise<DoorbellEventCreateResponseDto> {
    const r = await fetch(`${BASE}/events`, { method: "POST" });
    return asJson<DoorbellEventCreateResponseDto>(r);
}

export async function markAnswered(id: number): Promise<void> {
    const r = await fetch(`${BASE}/events/${id}/answered`, { method: "PATCH" });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
}

export async function finishEvent(id: number, talkSeconds: number): Promise<void> {
    const r = await fetch(`${BASE}/events/${id}/finish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ talkSeconds }),
    });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
}

export async function listEvents(limit = 50, offset = 0): Promise<DoorbellEvent[]> {
    const r = await fetch(`${BASE}/events?limit=${limit}&offset=${offset}`);
    return asJson<DoorbellEvent[]>(r);
}
