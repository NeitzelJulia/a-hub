package org.example.backend.client.openmeteo;

import org.example.backend.model.weather.OpenMeteoDto;

public interface OpenMeteoClient {

    OpenMeteoDto fetchDailySummary(double lat, double lon, String timezone, int days);

}
