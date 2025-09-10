package org.example.backend.model.weather;

import java.time.OffsetDateTime;

public record WeatherSnapshot(
        OffsetDateTime updatedAt,
        Now now,
        Day today,
        Day tomorrow
){
    public record Now(int tempC, int code) {}
    public record Day(
            Integer max,
            Integer min,
            Double  precipSum,
            Integer code,
            Integer precipProbMean,
            Integer precipProbMax,
            String  sunrise,
            String  sunset
    ) {}
}
