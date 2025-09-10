export type WeatherDay = {
    max: number | null;
    min: number | null;
    precipSum: number | null;
    code: number | null;
    precipProbMean: number | null;
    precipProbMax: number | null;
    sunrise: string | null;
    sunset: string | null;
};

export type WeatherSnapshot = {
    updatedAt: string;
    today: WeatherDay;
    tomorrow: WeatherDay;
};
