import { useClock } from "../hooks/useClock";
import "./ClockCard.css";

export function ClockCard() {
    const { time, date } = useClock();

    return (
        <div className="card clock-card">
            <div className="stack">
                <div className="big">{time}</div>
                <div className="muted">{date}</div>
            </div>

            <div className="stack center">
                <div className="eyebrow">Heute</div>
                <div className="big">—°C · Wetter</div>
            </div>

            <div className="stack right">
                <div className="eyebrow">Morgen</div>
                <div className="muted">—°C · Wetter</div>
            </div>
        </div>
    );
}
