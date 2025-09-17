package org.example.backend.controller;

import org.example.backend.model.waste.WasteNextDto;
import org.example.backend.service.WasteService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(WasteController.class)
class WasteControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private WasteService service;

    @Test
    void range_returns200_withArray() throws Exception {
        var date = LocalDate.of(2025, 9, 18);
        var dtos = List.of(
                new WasteNextDto("2025-09-18", "residual", "Graue Restmülltonne"),
                new WasteNextDto("2025-09-22", "plastic",  "Gelbe Tonne")
        );
        when(service.getDtosInWindow(date, 7)).thenReturn(dtos);

        mvc.perform(get("/api/waste/range")
                        .param("date", "2025-09-18")
                        .param("days", "7"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].dateISO", is("2025-09-18")))
                .andExpect(jsonPath("$[0].type", is("residual")))
                .andExpect(jsonPath("$[0].summary", is("Graue Restmülltonne")))
                .andExpect(jsonPath("$[1].dateISO", is("2025-09-22")))
                .andExpect(jsonPath("$[1].type", is("plastic")))
                .andExpect(jsonPath("$[1].summary", is("Gelbe Tonne")));

        verify(service, times(1)).getDtosInWindow(date, 7);
        verifyNoMoreInteractions(service);
    }

    @Test
    void range_missingDate_returns400() throws Exception {
        mvc.perform(get("/api/waste/range")
                        .param("days", "7"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @Test
    void import_withResource_returns200_andCount() throws Exception {
        when(service.importIcs("classpath:waste-calendar.ics")).thenReturn(5);

        mvc.perform(post("/api/waste/import")
                        .param("resource", "classpath:waste-calendar.ics"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.inserted", is(5)));

        verify(service, times(1)).importIcs("classpath:waste-calendar.ics");
        verifyNoMoreInteractions(service);
    }

    @Test
    void import_withoutResource_usesDefault_returns200_andCount() throws Exception {
        when(service.importIcs(null)).thenReturn(2);

        mvc.perform(post("/api/waste/import"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.inserted", is(2)));

        verify(service, times(1)).importIcs(isNull());
        verifyNoMoreInteractions(service);
    }
}
