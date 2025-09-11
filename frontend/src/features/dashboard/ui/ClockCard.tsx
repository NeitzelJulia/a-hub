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
                <div className="muted wx-desc">{tIcon.label}</div> {/* ← NEU */}
                <div className="big temp-row">
                    <span className="wx-icon" aria-hidden>{tIcon.emoji}</span>
                    <span>{formatTemperatureCelsius(today?.max)}</span>
                </div>
                <div className="muted rainline">
                    <span className="icon" aria-hidden>💧</span>
                    <span>{formatProbabilityPercent(today?.precipProbMax)} · {formatPrecipitationMm(today?.precipSum)}</span>
                </div>
            </div>

            <div>
                <div className="eyebrow">Morgen</div>
                <div className="muted wx-desc">{mIcon.label}</div> {/* ← NEU */}
                <div className="big temp-row">
                    <span className="wx-icon" aria-hidden>{mIcon.emoji}</span>
                    <span>{formatTemperatureCelsius(tomorrow?.max)}</span>
                </div>
                <div className="muted rainline">
                    <span className="icon" aria-hidden>💧</span>
                    <span>{formatProbabilityPercent(tomorrow?.precipProbMax)} · {formatPrecipitationMm(tomorrow?.precipSum)}</span>
                </div>
            </div>
        </div>
    );
}
