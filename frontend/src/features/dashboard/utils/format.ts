export type NullableNumber = number | null | undefined;

const precipitationNumberFormat = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
});

export function formatTemperatureCelsius(value: NullableNumber): string {
    return value == null ? "—" : `${value}°C`;
}

export function formatPrecipitationMm(value: NullableNumber): string {
    return value == null ? "— mm" : `${precipitationNumberFormat.format(value)} mm`;
}

export function formatProbabilityPercent(value: NullableNumber): string {
    return value == null ? "—%" : `${Math.round(value)}%`;
}