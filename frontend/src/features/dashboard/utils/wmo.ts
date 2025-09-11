export type WeatherIconInfo = {
    emoji: string;
    label: string;
};

const DEFAULT_ICON: WeatherIconInfo = { emoji: "—", label: "Wetter" } as const;

const WMO_ICON: Readonly<Record<number, WeatherIconInfo>> = {
    // Klar / Wolken
    0: { emoji: "☀️", label: "Klar" },
    1: { emoji: "🌤️", label: "Meist klar" },
    2: { emoji: "⛅",  label: "Wolkig" },
    3: { emoji: "☁️",  label: "Bedeckt" },

    // Nebel
    45: { emoji: "🌫️", label: "Nebel" },
    48: { emoji: "🌫️", label: "Nebel (mit Reif)" },

    // Sprühregen (Drizzle)
    51: { emoji: "🌦️", label: "Leichter Sprühregen" },
    53: { emoji: "🌦️", label: "Mäßiger Sprühregen" },
    55: { emoji: "🌦️", label: "Starker Sprühregen" },

    // Gefrierender Sprühregen / Regen
    56: { emoji: "🌦️", label: "Gefrierender Sprühregen (leicht)" },
    57: { emoji: "🌦️", label: "Gefrierender Sprühregen (stark)" },
    66: { emoji: "🌧️", label: "Gefrierender Regen (leicht)" },
    67: { emoji: "🌧️", label: "Gefrierender Regen (stark)" },

    // Dauerregen
    61: { emoji: "🌧️", label: "Leichter Regen" },
    63: { emoji: "🌧️", label: "Mäßiger Regen" },
    65: { emoji: "🌧️", label: "Starker Regen" },

    // Schauerregen
    80: { emoji: "🌦️", label: "Leichter Schauerregen" },
    81: { emoji: "🌦️", label: "Mäßiger Schauerregen" },
    82: { emoji: "🌧️", label: "Heftiger Schauerregen" },

    // Schnee / Schneeschauer
    71: { emoji: "🌨️", label: "Leichter Schneefall" },
    73: { emoji: "🌨️", label: "Mäßiger Schneefall" },
    75: { emoji: "🌨️", label: "Starker Schneefall" },
    77: { emoji: "❄️",  label: "Schneegriesel" },
    85: { emoji: "🌨️", label: "Leichter Schneeschauer" },
    86: { emoji: "🌨️", label: "Starker Schneeschauer" },

    // Gewitter
    95: { emoji: "⛈️", label: "Gewitter" },
    96: { emoji: "⛈️", label: "Gewitter mit Hagel" },
    99: { emoji: "⛈️", label: "Heftiges Gewitter mit Hagel" },
} as const;

export function wmoToIcon(code: number | null | undefined): WeatherIconInfo {
    return WMO_ICON[code ?? -1] ?? DEFAULT_ICON;
}
