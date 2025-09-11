package org.example.backend.controller;

import org.example.backend.model.weather.WeatherSnapshot;
import org.example.backend.service.WeatherService;
import org.example.backend.service.WeatherStreamBroadcaster;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.OffsetDateTime;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class WeatherControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private WeatherService service;

    @MockitoBean
    private WeatherStreamBroadcaster broadcaster;

    @BeforeEach
    void setUp() throws IOException {
        var today = new WeatherSnapshot.Day(
                21,
                12,
                0.3,
                2,
                40,
                70,
                "2025-09-10T06:54",
                "2025-09-10T19:43"
        );
        var tomorrow = new WeatherSnapshot.Day(
                18,
                10,
                2.1,
                61,
                60,
                80,
                "2025-09-11T06:56",
                "2025-09-11T19:41"
        );
        var snap = new WeatherSnapshot(
                OffsetDateTime.parse("2025-09-10T08:00:00+02:00"),
                today,
                tomorrow
        );

        when(service.snapshot()).thenReturn(snap);
        var emitter = new SseEmitter();
        when(broadcaster.register(snap)).thenReturn(emitter);
        emitter.complete();
    }

    @Test
    void get_shouldReturnSnapshot() throws Exception {

        mockMvc.perform(get("/api/weather"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.today.max").value(21))
                .andExpect(jsonPath("$.today.min").value(12))
                .andExpect(jsonPath("$.today.precipSum").value(0.3))
                .andExpect(jsonPath("$.today.code").value(2))
                .andExpect(jsonPath("$.today.precipProbMean").value(40))
                .andExpect(jsonPath("$.today.precipProbMax").value(70))
                .andExpect(jsonPath("$.today.sunrise").value("2025-09-10T06:54"))
                .andExpect(jsonPath("$.today.sunset").value("2025-09-10T19:43"))
                .andExpect(jsonPath("$.tomorrow.max").value(18))
                .andExpect(jsonPath("$.tomorrow.min").value(10))
                .andExpect(jsonPath("$.tomorrow.precipSum").value(2.1))
                .andExpect(jsonPath("$.tomorrow.code").value(61));
    }

    @Test
    void stream_registersEmitter_andReturnsEventStream() throws Exception {
        var mvcResult = mockMvc.perform(
                        get("/api/weather/stream")
                                .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(request().asyncStarted())
                .andReturn();

        mockMvc.perform(asyncDispatch(mvcResult))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", Matchers.startsWith("text/event-stream")));
    }
}
