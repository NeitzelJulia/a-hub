package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.model.weather.OpenMeteoDto;
import org.example.backend.model.weather.WeatherSnapshot;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

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
    private final RestClient http = RestClient.create();
    private final AtomicReference<WeatherSnapshot> cache = new AtomicReference<>();

    public WeatherSnapshot snapshot() { return cache.get(); }

    @Scheduled(initialDelay = 5_000, fixedDelay = REFRESH_DELAY_MS)
    public void refresh() {
        String url = "https://api.open-meteo.com/v1/forecast"
                + "?latitude=" + LAT
                + "&longitude=" + LON
                + "&current_weather=true"
                + "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,"
                + "sunrise,sunset,precipitation_probability_mean,precipitation_probability_max"
                + "&timezone=" + TIMEZONE;

        try {
            var data = http.get().uri(url).retrieve().body(OpenMeteoDto.class);
            if (data == null || data.current_weather() == null || data.daily() == null) return;

            var cur = data.current_weather();
            var d   = data.daily();

            var now = new WeatherSnapshot.Now(
                    (int)Math.round(cur.temperature()),
                    cur.weathercode()
            );

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

            var snap = new WeatherSnapshot(OffsetDateTime.now(), now, today, tomorrow);
            cache.set(snap);
            broadcaster.broadcast(snap);
            log.debug("weather refreshed: now={}°C, today.max={}, tomorrow.max={}",
                    now.tempC(), today.max(), tomorrow.max());
        } catch (Exception ex) {
            log.warn("weather refresh failed: {}", ex.getMessage());
        }
    }

    private static <T> T getAt(java.util.List<T> list, int i) {
        return (list != null && list.size() > i) ? list.get(i) : null;
    }
}
