export function wmoToIcon(code: number | null | undefined) {
    const c = code ?? -1;
    if (c === 0) return { emoji: "☀️", label: "Klar" };
    if (c === 1 || c === 2 || c === 3) return { emoji: "⛅", label: "Wolken" };
    if (c === 45 || c === 48) return { emoji: "🌫️", label: "Nebel" };
    if ([51,53,55,61,63,65,66,67,80,81,82].includes(c)) return { emoji: "🌧️", label: "Regen" };
    if ([71,73,75,85,86].includes(c)) return { emoji: "❄️", label: "Schnee" };
    if ([95,96,99].includes(c)) return { emoji: "⛈️", label: "Gewitter" };

    return { emoji: "—", label: "Wetter" };
}
