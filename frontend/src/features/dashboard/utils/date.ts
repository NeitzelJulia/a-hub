export function labelFor(dateISO: string): string {
    const d = new Date(`${dateISO}T00:00:00`);
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    if (d.getTime() === startOfTomorrow.getTime()) return "Morgen";
    if (d.getTime() === startOfToday.getTime()) return "Heute";

    const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    return days[d.getDay()];
}
