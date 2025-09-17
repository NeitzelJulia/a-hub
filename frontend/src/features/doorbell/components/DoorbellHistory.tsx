import { useCallback, useEffect, useState } from "react";
import { listEvents } from "../utils/historyApi";
import { onHistoryRefresh } from "../utils/historyBus";
import type { DoorbellEvent } from "../models/DoorbellEvent";
import "./DoorbellHistory.css";

type Props = { limit?: number; className?: string };

function toLabelParts(ms: number): { date: string; time: string } {
    const d = new Date(ms);
    const now = new Date();
    const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

    const todayStr = now.toDateString();
    const yestStr = new Date(now.getTime() - 86_400_000).toDateString();
    const dStr = d.toDateString();

    if (dStr === todayStr)   return { date: "heute",   time };
    if (dStr === yestStr)    return { date: "gestern", time };

    // DD.MM.YY
    const date = d.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
    });
    return { date, time };
}

export default function DoorbellHistory({ limit = 6, className = "" }: Readonly<Props>) {
    const [items, setItems] = useState<DoorbellEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true); setErr(null);
        try {
            const data = await listEvents(limit, 0);
            setItems(data);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setErr(msg || "Load failed");
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => { void load(); }, [load]);
    useEffect(() => onHistoryRefresh(() => { void load(); }), [load]);

    return (
        <div className={`card ${className}`}>
            <div className="title">Klingel-Historie</div>

            {loading && <div className="muted text-sm">Lade…</div>}
            {err && <div className="text-sm" style={{ color: "#b00020" }}>Fehler: {err}</div>}
            {!loading && !err && items.length === 0 && (
                <div className="muted text-sm">Keine Einträge</div>
            )}

            {!loading && !err && items.length > 0 && (
                <ul className="list hist-list">
                    {items.map(e => {
                        const { date, time } = toLabelParts(e.occurredAtMillis);
                        const badgeClass = e.answered ? "badge ok" : "badge warn";
                        const badgeText = e.answered ? "angenommen" : "verpasst";
                        const extra = e.answered && e.talkSeconds > 0 ? `⏱ ${e.talkSeconds}s` : "";

                        return (
                            <li className="hist-row" key={e.id}>
                                <span className={`hist-badge ${badgeClass}`}>{badgeText}</span>
                                <span className="hist-date">{date}</span>
                                <span className="hist-time">{time}</span>
                                <span className="hist-extra">{extra}</span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
