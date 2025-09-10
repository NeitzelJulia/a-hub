package org.example.backend.service;

import org.example.backend.client.openmeteo.OpenMeteoClient;
import org.example.backend.model.weather.OpenMeteoDto;
import org.example.backend.model.weather.WeatherSnapshot;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WeatherServiceTest {

    @Mock
    WeatherStreamBroadcaster broadcaster;

    @Mock
    OpenMeteoClient meteo;

    @InjectMocks
    WeatherService service;

    @Test
    void refresh_success_populatesCache_andBroadcasts() {
        var dto = new OpenMeteoDto(
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
        when(meteo.fetchDailySummary(anyDouble(), anyDouble(), anyString(), eq(2))).thenReturn(dto);

        service.refresh();

        verify(broadcaster, times(1)).broadcast(any(WeatherSnapshot.class));
        var snap = service.snapshot();
        assertNotNull(snap);

        assertEquals(21, snap.today().max());
        assertEquals(12, snap.today().min());
        assertEquals(0.3, snap.today().precipSum());
        assertEquals(2,   snap.today().code());
        assertEquals(40,  snap.today().precipProbMean());
        assertEquals(70,  snap.today().precipProbMax());
        assertEquals("2025-09-10T06:54", snap.today().sunrise());
        assertEquals("2025-09-10T19:43", snap.today().sunset());

        assertEquals(18,  snap.tomorrow().max());
        assertEquals(10,  snap.tomorrow().min());
        assertEquals(2.1, snap.tomorrow().precipSum());
        assertEquals(61,  snap.tomorrow().code());
    }

}
