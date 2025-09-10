package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.model.weather.WeatherSnapshot;
import org.example.backend.service.WeatherService;
import org.example.backend.service.WeatherStreamBroadcaster;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;

@RestController
@RequestMapping("/api/weather")
@RequiredArgsConstructor
public class WeatherController {
    private final WeatherService service;
    private final WeatherStreamBroadcaster broadcaster;

    @GetMapping
    public WeatherSnapshot get() {
        return service.snapshot();
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() throws IOException {
        return broadcaster.register(service.snapshot());
    }
}
