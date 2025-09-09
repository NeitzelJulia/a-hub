import { useEffect, useMemo, useState } from "react";

const TZ = "Europe/Berlin";
const LOCALE = "de-DE";

function fmtTime(d: Date) {
    return new Intl.DateTimeFormat(LOCALE, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: TZ,
    }).format(d);
}

function fmtDate(d: Date) {
    const parts = new Intl.DateTimeFormat(LOCALE, {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: TZ,
    }).format(d);
    return parts.replaceAll(".", "").replace(/\s*,\s*/g, ", ");
}

export function useClock(intervalMs = 1000) {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), intervalMs);
        return () => clearInterval(t);
    }, [intervalMs]);

    const time = useMemo(() => fmtTime(now), [now]);
    const date = useMemo(() => fmtDate(now), [now]);
    return { now, time, date };
}
