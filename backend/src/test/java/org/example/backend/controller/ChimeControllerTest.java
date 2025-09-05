package org.example.backend.controller;

import org.example.backend.model.SoundSource;
import org.example.backend.service.ChimeService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ChimeController.class)
class ChimeControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private ChimeService chime;

    @Test
    @DisplayName("404 + candidates, wenn keine Quelle vorhanden ist")
    void play_returns404_whenNoSource() throws Exception {
        when(chime.resolveSource()).thenReturn(Optional.empty());
        when(chime.candidates()).thenReturn(List.of("sounds/doorbell.mp3", "sounds/doorbell.wav"));

        mvc.perform(post("/api/chime/play"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.error", is("not_found")))
                .andExpect(jsonPath("$.candidates", containsInAnyOrder("sounds/doorbell.mp3", "sounds/doorbell.wav")));

        verify(chime, never()).playAsync(any());
        verify(chime).resolveSource();
        verify(chime).candidates();
        verifyNoMoreInteractions(chime);
    }

    @Test
    @DisplayName("200 + started=true, wenn MP3 vorhanden ist; Service.playAsync() wird aufgerufen")
    void play_returns200_andCallsService_forMp3() throws Exception {
        var src = new SoundSource("sounds/doorbell.mp3", true);
        when(chime.resolveSource()).thenReturn(Optional.of(src));

        mvc.perform(post("/api/chime/play"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.started", is(true)))
                .andExpect(jsonPath("$.source", is("sounds/doorbell.mp3")));

        var cap = ArgumentCaptor.forClass(SoundSource.class);
        verify(chime).playAsync(cap.capture());
        verify(chime).resolveSource();
        verifyNoMoreInteractions(chime);
    }

    @Test
    @DisplayName("200 + started=true, wenn WAV vorhanden ist; Service.playAsync() wird aufgerufen")
    void play_returns200_andCallsService_forWav() throws Exception {
        var src = new SoundSource("sounds/doorbell.wav", false);
        when(chime.resolveSource()).thenReturn(Optional.of(src));

        mvc.perform(post("/api/chime/play"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.started", is(true)))
                .andExpect(jsonPath("$.source", is("sounds/doorbell.wav")));

        verify(chime).playAsync(src);
        verify(chime).resolveSource();
        verifyNoMoreInteractions(chime);
    }
}
