package org.example.backend.controller;

import org.example.backend.model.doorbell.DoorbellEvent;
import org.example.backend.service.DoorbellHistoryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DoorbellHistoryController.class)
class DoorbellHistoryControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private DoorbellHistoryService service;

    @Test
    void create_returns200_withIdAndTs() throws Exception {
        var persisted = new DoorbellEvent(42L, 123456789L, false, 0);
        when(service.createEvent()).thenReturn(persisted);

        mvc.perform(post("/api/history/events"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id", is(42)))
                .andExpect(jsonPath("$.occurredAtMillis", is(123456789)));

        verify(service, times(1)).createEvent();
        verifyNoMoreInteractions(service);
    }

    @Test
    void answered_returns204() throws Exception {
        mvc.perform(patch("/api/history/events/{id}/answered", 7))
                .andExpect(status().isNoContent());

        verify(service, times(1)).markAnswered(7L);
        verifyNoMoreInteractions(service);
    }

    @Test
    void finish_returns204() throws Exception {
        mvc.perform(patch("/api/history/events/{id}/finish", 9)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"talkSeconds\":12}"))
                .andExpect(status().isNoContent());

        verify(service, times(1)).finish(9L, 12);
        verifyNoMoreInteractions(service);
    }

    @Test
    void finish_sanitizesNegativeSecondsToZero() throws Exception {
        mvc.perform(patch("/api/history/events/{id}/finish", 9)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"talkSeconds\":-5}"))
                .andExpect(status().isNoContent());

        verify(service, times(1)).finish(9L, 0);
        verifyNoMoreInteractions(service);
    }

    @Test
    void list_returns200_withArray() throws Exception {
        var a = new DoorbellEvent(2L, 2000L, true, 5);
        var b = new DoorbellEvent(1L, 1000L, false, 0);
        when(service.latest(3, 1)).thenReturn(List.of(a, b));

        mvc.perform(get("/api/history/events")
                        .param("limit", "3")
                        .param("offset", "1"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id", is(2)))
                .andExpect(jsonPath("$[0].occurredAtMillis", is(2000)))
                .andExpect(jsonPath("$[0].answered", is(true)))
                .andExpect(jsonPath("$[0].talkSeconds", is(5)))
                .andExpect(jsonPath("$[1].id", is(1)))
                .andExpect(jsonPath("$[1].occurredAtMillis", is(1000)))
                .andExpect(jsonPath("$[1].answered", is(false)))
                .andExpect(jsonPath("$[1].talkSeconds", is(0)));

        verify(service, times(1)).latest(3, 1);
        verifyNoMoreInteractions(service);
    }

    @Test
    void get_returns200_whenFound() throws Exception {
        var e = new DoorbellEvent(5L, 5000L, true, 10);
        when(service.get(5L)).thenReturn(e);

        mvc.perform(get("/api/history/events/{id}", 5))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id", is(5)))
                .andExpect(jsonPath("$.occurredAtMillis", is(5000)))
                .andExpect(jsonPath("$.answered", is(true)))
                .andExpect(jsonPath("$.talkSeconds", is(10)));

        verify(service, times(1)).get(5L);
        verifyNoMoreInteractions(service);
    }

    @Test
    void get_returns404_whenNotFound() throws Exception {
        when(service.get(404L)).thenReturn(null);

        mvc.perform(get("/api/history/events/{id}", 404))
                .andExpect(status().isNotFound());

        verify(service, times(1)).get(404L);
        verifyNoMoreInteractions(service);
    }
}
