package org.example.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.example.backend.model.weather.WeatherSnapshot;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.concurrent.CopyOnWriteArrayList;

@Slf4j
@Component
public class WeatherStreamBroadcaster {
    private final CopyOnWriteArrayList<SseEmitter> clients = new CopyOnWriteArrayList<>();

    public SseEmitter register(WeatherSnapshot initial) throws IOException {
        var emitter = new SseEmitter(0L);
        emitter.onCompletion(() -> clients.remove(emitter));
        emitter.onTimeout(() -> clients.remove(emitter));
        clients.add(emitter);

        if (initial != null) {
            emitter.send(SseEmitter.event().name("weather").data(initial));
        }
        log.debug("SSE client connected. total={}", clients.size());
        return emitter;
    }

    public void broadcast(WeatherSnapshot snapshot) {
        for (var client : clients) {
            try {
                client.send(SseEmitter.event().name("weather").data(snapshot));
            } catch (IOException e) {
                clients.remove(client);
                log.debug("SSE client dropped. total={}", clients.size());
            }
        }
    }
}
