package org.example.backend.client.openmeteo;

import lombok.RequiredArgsConstructor;
import org.example.backend.model.weather.OpenMeteoDto;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@RequiredArgsConstructor
public class OpenMeteoRestClient implements OpenMeteoClient {

    private final RestClient.Builder builder;

    @Override
    public OpenMeteoDto fetchDailySummary(double lat, double lon, String tz, int days) {
        var http = builder.baseUrl("https://api.open-meteo.com").build();
        var url = "/v1/forecast"
                + "?latitude=" + lat
                + "&longitude=" + lon
                + "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,"
                + "sunrise,sunset,precipitation_probability_mean,precipitation_probability_max"
                + "&forecast_days=" + days
                + "&timezone=" + tz;
        return http.get().uri(url).retrieve().body(OpenMeteoDto.class);
    }
}
