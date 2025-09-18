import { useEffect, useState } from "react";
import { labelFor } from "../utils/date";
import type { WasteNextDto } from "../types/waste";
import "./WasteCalendarCard.css";

function todayISO(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Swatch({ type }: Readonly<{ type: string }>) {
    const title = {
        paper: "Papier",
        residual: "Restmüll",
        bio: "Bio",
        plastic: "Gelb",
        glass: "Glas",
        hazardous: "Schadstoff",
        unknown: "Unbekannt",
    }[type] ?? "Unbekannt";

    return <span className={`wc-swatch ${type}`} aria-label={title} title={title} />;
}

const stableKey = (e: WasteNextDto) => `${e.dateISO}|${e.type}|${e.summary}`;

export default function WasteCalendarCard() {
    const [items, setItems] = useState<WasteNextDto[] | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | null = null;

        const fetchData = async () => {
            setErr(null);
            try {
                const url = `/api/waste/range?date=${todayISO()}&days=7`;
                const res = await fetch(url, {
                    headers: { Accept: "application/json" },
                    signal: controller.signal,
                });

                if (!res.ok) {
                    setItems([]);
                    setErr(`HTTP ${res.status}${res.statusText ? " " + res.statusText : ""}`);
                    return;
                }

                const data = (await res.json()) as WasteNextDto[];
                setItems((data ?? []).slice(0, 2));
            } catch (err: unknown) {
                if (err instanceof DOMException && err.name === "AbortError") return;
                const msg = err instanceof Error ? err.message : String(err);
                setItems([]);
                setErr(msg);
            }
        };

        void fetchData();

        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0, 0);
        const ms = Math.max(5000, next.getTime() - now.getTime());
        timer = setTimeout(() => { void fetchData(); }, ms);

        return () => {
            controller.abort();
            if (timer) clearTimeout(timer);
        };
    }, []);

    return (
        <div className="card">
            <div className="title">Müllkalender</div>

            {!items && !err && (
                <ul className="list compact">
                    <li>lädt …</li>
                </ul>
            )}

            {err && (
                <ul className="list compact">
                    <li>⚠️ {err}</li>
                </ul>
            )}

            {items && !err && items.length === 0 && (
                <ul className="list compact">
                    <li>Keine Abholungen in den nächsten Tagen</li>
                </ul>
            )}

            {items && !err && items.length > 0 && (
                <ul className="list compact">
                    {items.map((e) => (
                        <li key={stableKey(e)}>
                            <Swatch type={e.type} /> {labelFor(e.dateISO)}: {e.summary}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
