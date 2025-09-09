import "./DashboardLayout.css";

type SlotClass =
    | "" | "auto"
    | "grow-2" | "grow-3"
    | "grow-4" | "shrink";

type Props = {
    topLeft?: React.ReactNode;
    topRight?: React.ReactNode;
    mainLeft?: React.ReactNode;
    mainRight?: React.ReactNode;
    bottomLeft?: React.ReactNode;
    bottomRight?: React.ReactNode;

    /** optionale Klassen zur Höhenverteilung je Slot */
    topLeftClass?: SlotClass;
    topRightClass?: SlotClass;
    mainLeftClass?: SlotClass;
    mainRightClass?: SlotClass;
    bottomLeftClass?: SlotClass;
    bottomRightClass?: SlotClass;

    className?: string;
};

export function DashboardLayout({
                                    topLeft, topRight,
                                    mainLeft, mainRight,
                                    bottomLeft, bottomRight,
                                    topLeftClass = "",
                                    topRightClass = "",
                                    mainLeftClass = "",
                                    mainRightClass = "",
                                    bottomLeftClass = "",
                                    bottomRightClass = "",
                                    className
                                }: Readonly<Props>) {
    return (
        <main className={["dash-cols", className].filter(Boolean).join(" ")}>
            <section className="col col-left">
                {topLeft     && <div className={["block", topLeftClass    ].filter(Boolean).join(" ")}>{topLeft}</div>}
                {mainLeft    && <div className={["block", mainLeftClass   ].filter(Boolean).join(" ")}>{mainLeft}</div>}
                {bottomLeft  && <div className={["block", bottomLeftClass ].filter(Boolean).join(" ")}>{bottomLeft}</div>}
            </section>

            <aside className="col col-right">
                {topRight    && <div className={["block", topRightClass   ].filter(Boolean).join(" ")}>{topRight}</div>}
                {mainRight   && <div className={["block", mainRightClass  ].filter(Boolean).join(" ")}>{mainRight}</div>}
                {bottomRight && <div className={["block", bottomRightClass].filter(Boolean).join(" ")}>{bottomRight}</div>}
            </aside>
        </main>
    );
}
