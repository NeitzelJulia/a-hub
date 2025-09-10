import { useClock } from "../hooks/useClock";
import { useWeather } from "../hooks/useWeather";
import { wmoToIcon } from "../utils/wmo";
import { formatTemperatureCelsius,
    formatPrecipitationMm,
    formatProbabilityPercent } from "../utils/format"
import "./ClockCard.css";

export function ClockCard() {
    const { time, date } = useClock();
    const snap = useWeather();

    const today = snap?.today;
    const tomorrow = snap?.tomorrow;

    const tIcon = wmoToIcon(today?.code ?? null);
    const mIcon = wmoToIcon(tomorrow?.code ?? null);

    return (
        <div className="card clock-card">
            <div>
                <div className="big">{time}</div>
                <div className="muted">{date}</div>
            </div>

            <div>
                <div className="eyebrow">Heute</div>
                <div className="big" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span aria-hidden>{tIcon.emoji}</span>
                    <span>{formatTemperatureCelsius(today?.max)}</span>
                </div>
                <div
                    className="muted rainline"
                    title={`Max. Regenwahrsch.: ${formatProbabilityPercent(today?.precipProbMax)}`}
                >
                    <span className="icon" aria-hidden>💧</span>
                    <span>{formatProbabilityPercent(today?.precipProbMean)} · {formatPrecipitationMm(today?.precipSum)}</span>
                </div>
            </div>

            <div>
                <div className="eyebrow">Morgen</div>
                <div className="big" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span aria-hidden>{mIcon.emoji}</span>
                    <span>{formatTemperatureCelsius(tomorrow?.max)}</span>
                </div>
                <div
                    className="muted rainline"
                    title={`Max. Regenwahrsch.: ${formatProbabilityPercent(tomorrow?.precipProbMax)}`}
                >
                    <span className="icon" aria-hidden>💧</span>
                    <span>{formatTemperatureCelsius(tomorrow?.precipProbMean)} · {formatPrecipitationMm(tomorrow?.precipSum)}</span>
                </div>
            </div>
        </div>
    );
}
