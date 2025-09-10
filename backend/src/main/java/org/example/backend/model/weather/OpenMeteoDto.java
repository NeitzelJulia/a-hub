package org.example.backend.model.weather;

import java.util.List;

public record OpenMeteoDto(
        Daily daily
){
    public record Daily(
            List<String>  time,
            List<Integer> temperature_2m_max,
            List<Integer> temperature_2m_min,
            List<Double>  precipitation_sum,
            List<Integer> weathercode,
            List<String>  sunrise,
            List<String>  sunset,
            List<Integer> precipitation_probability_mean,
            List<Integer> precipitation_probability_max
    ) {}
}

