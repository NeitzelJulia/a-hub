package org.example.backend.controller;

import org.example.backend.client.openmeteo.OpenMeteoClient;
import org.example.backend.model.weather.OpenMeteoDto;
import org.example.backend.service.WeatherService;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class WeatherControllerIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private WeatherService weatherService;

    @MockitoBean
    private OpenMeteoClient meteoClient;

    private OpenMeteoDto sampleDto() {
        return new OpenMeteoDto(
                new OpenMeteoDto.Daily(
                        List.of("2025-09-10","2025-09-11"),
                        List.of(21, 18),
                        List.of(12, 10),
                        List.of(0.3, 2.1),
                        List.of(2, 61),
                        List.of("2025-09-10T06:54","2025-09-11T06:56"),
                        List.of("2025-09-10T19:43","2025-09-11T19:41"),
                        List.of(40, 60),
                        List.of(70, 80)
                )
        );
    }

    @Test
    void get_shouldReturnSnapshot_afterRefresh() throws Exception {
        when(meteoClient.fetchDailySummary(anyDouble(), anyDouble(), anyString(), eq(2)))
                .thenReturn(sampleDto());

        // Build cache via service
        weatherService.refresh();

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
    void stream_shouldReturnEventStream() throws Exception {
        when(meteoClient.fetchDailySummary(anyDouble(), anyDouble(), anyString(), eq(2)))
                .thenReturn(sampleDto());

        weatherService.refresh();

        mockMvc.perform(get("/api/weather/stream"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", Matchers.startsWith("text/event-stream")));
    }
}
