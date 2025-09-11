package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.client.openmeteo.OpenMeteoClient;
import org.example.backend.model.weather.OpenMeteoDto;
import org.example.backend.model.weather.WeatherSnapshot;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Service
@RequiredArgsConstructor
public class WeatherService {

    // --- Hardcoded Settings (später konfigurierbar) ---
    private static final double LAT = 51.938;
    private static final double LON = 8.875;
    private static final String TIMEZONE = "Europe/Berlin";
    private static final int REFRESH_MINUTES = 60;
    private static final long REFRESH_DELAY_MS = REFRESH_MINUTES * 60_000L;

    private final WeatherStreamBroadcaster broadcaster;
    private final OpenMeteoClient meteo;

    private final AtomicReference<WeatherSnapshot> cache = new AtomicReference<>();

    public WeatherSnapshot snapshot() { return cache.get(); }

    @Scheduled(initialDelay = 5_000, fixedDelay = REFRESH_DELAY_MS)
    public void refresh() {
        try {
            OpenMeteoDto data = meteo.fetchDailySummary(LAT, LON, TIMEZONE, 2);
            if (data == null || data.daily() == null) return;

            var d = data.daily();

            var today = new WeatherSnapshot.Day(
                    getAt(d.temperature_2m_max(), 0),
                    getAt(d.temperature_2m_min(), 0),
                    getAt(d.precipitation_sum(), 0),
                    getAt(d.weathercode(), 0),
                    getAt(d.precipitation_probability_mean(), 0),
                    getAt(d.precipitation_probability_max(), 0),
                    getAt(d.sunrise(), 0),
                    getAt(d.sunset(), 0)
            );

            var tomorrow = new WeatherSnapshot.Day(
                    getAt(d.temperature_2m_max(), 1),
                    getAt(d.temperature_2m_min(), 1),
                    getAt(d.precipitation_sum(), 1),
                    getAt(d.weathercode(), 1),
                    getAt(d.precipitation_probability_mean(), 1),
                    getAt(d.precipitation_probability_max(), 1),
                    getAt(d.sunrise(), 1),
                    getAt(d.sunset(), 1)
            );

            var snap = new WeatherSnapshot(OffsetDateTime.now(), today, tomorrow);
            cache.set(snap);
            broadcaster.broadcast(snap);
            log.debug("weather refreshed (daily summary): today.max={}, tomorrow.max={}",
                    today.max(), tomorrow.max());
        } catch (Exception ex) {
            log.warn("weather refresh failed: {}", ex.getMessage());
        }
    }

    private static <T> T getAt(java.util.List<T> list, int i) {
        return (list != null && list.size() > i) ? list.get(i) : null;
    }
}
