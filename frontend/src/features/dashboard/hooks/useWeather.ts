import { useEffect, useState } from "react";
import type { WeatherSnapshot } from "../api/weatherTypes";

export function useWeather() {
    const [data, setData] = useState<WeatherSnapshot | null>(null);

    useEffect(() => {
        const es = new EventSource("/api/weather/stream");

        const onWeather = (e: MessageEvent) => {
            try {
                const payload = JSON.parse(e.data) as WeatherSnapshot;
                setData(payload);
            } catch (err) {
                console.warn("SSE(weather): failed to parse payload", err, e.data);
            }
        };

        es.addEventListener("weather", onWeather);
        es.onerror = (err) => {
            console.warn("SSE(weather) error – will attempt auto-reconnect", err);
        };

        return () => {
            es.removeEventListener("weather", onWeather);
            es.close();
        };
    }, []);

    return data;
}
