package org.example.backend.service;

import org.example.backend.model.weather.WeatherSnapshot;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.lang.reflect.Field;
import java.time.OffsetDateTime;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.*;

class WeatherStreamBroadcasterTest {

    @Test
    void register_shouldAddEmitter() throws Exception {
        // GIVEN
        var broadcaster = new WeatherStreamBroadcaster();
        var snap = sampleSnapshot();

        // WHEN
        SseEmitter emitter = broadcaster.register(snap);

        // THEN
        assertNotNull(emitter);
        assertEquals(1, clients(broadcaster).size(), "Emitter should be registered");
    }

    @Test
    void broadcast_shouldRemoveClient_whenSendThrowsIOException() throws Exception {
        // GIVEN
        var broadcaster = new WeatherStreamBroadcaster();
        var bad = new ThrowingEmitter();
        clients(broadcaster).add(bad);
        assertEquals(1, clients(broadcaster).size(), "Precondition: one client");

        // WHEN
        broadcaster.broadcast(sampleSnapshot());

        // THEN
        assertEquals(0, clients(broadcaster).size(), "Bad client should be removed on IOException");
    }

    // Helpers
    private static WeatherSnapshot sampleSnapshot() {
        var today = new WeatherSnapshot.Day(21, 12, 0.3, 2, 40, 70,
                "2025-09-10T06:54", "2025-09-10T19:43");
        var tomorrow = new WeatherSnapshot.Day(18, 10, 2.1, 61, 60, 80,
                "2025-09-11T06:56", "2025-09-11T19:41");
        return new WeatherSnapshot(OffsetDateTime.parse("2025-09-10T08:00:00+02:00"), today, tomorrow);
    }

    @SuppressWarnings("unchecked")
    private static CopyOnWriteArrayList<SseEmitter> clients(WeatherStreamBroadcaster b) throws Exception {
        Field f = WeatherStreamBroadcaster.class.getDeclaredField("clients");
        f.setAccessible(true);
        return (CopyOnWriteArrayList<SseEmitter>) f.get(b);
    }

    private static class ThrowingEmitter extends SseEmitter {
        ThrowingEmitter() { super(0L); }
        @Override
        public void send(SseEventBuilder builder) throws java.io.IOException {
            throw new java.io.IOException("boom");
        }
    }
}
