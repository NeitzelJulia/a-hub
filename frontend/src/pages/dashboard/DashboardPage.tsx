import { DashboardLayout } from "../../features/dashboard";
import "./DashboardPage.css";
import {ClockCard} from "../../features/dashboard/ui/ClockCard.tsx";

export default function DashboardPage() {
    return (
        <DashboardLayout
            topLeftClass="grow-2"
            mainLeftClass="grow-3"
            bottomLeftClass="grow-3"

            topRightClass="grow-2"
            mainRightClass="grow-2"
            bottomRightClass="auto"

            topLeft={
                <ClockCard/>
            }

            topRight={
                <div className="card">
                    <div className="eyebrow">a-door</div>
                    <div className="chip chip-ok">● Online</div>
                    <div className="muted">zuletzt gesehen: vor 2 min</div>
                </div>
            }

            mainLeft={
                <div className="card">
                    <div className="title">Klingel-Historie</div>
                    <ul className="list">
                        <li>
                            <span className="badge ok">angenommen</span>
                            <span className="item-text">09:42 · Besucher</span>
                        </li>
                        <li>
                            <span className="badge warn">verpasst</span>
                            <span className="item-text">07:15 · Lieferung</span>
                        </li>
                        <li>
                            <span className="badge ok">angenommen</span>
                            <span className="item-text">Gestern · 18:03</span>
                        </li>
                    </ul>
                </div>
            }

            mainRight={
                <div className="card stack">
                    <div className="title">Aktionen</div>
                    <button className="btn">⚙️ Einstellungen</button>
                    <button className="btn secondary">➕ Weitere Apps</button>
                </div>
            }

            bottomLeft={
                <div className="card">
                    <div className="title">Termine · heute & morgen</div>
                    <ul className="list">
                        <li><span className="dot" /> Heute · 14:00 – Arzt</li>
                        <li><span className="dot" /> Morgen · 07:00 – Müll</li>
                    </ul>
                </div>
            }

            bottomRight={
                <div className="card">
                    <div className="title">Müllkalender</div>
                    <ul className="list compact">
                        <li><span className="swatch paper" /> Morgen: Papier</li>
                        <li><span className="swatch residual" /> Fr: Restmüll</li>
                    </ul>
                </div>
            }
        />
    );
}
