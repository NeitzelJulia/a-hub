package org.example.backend.service;

import org.example.backend.model.SoundSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ChimeServiceSmokeTest {

    private final ChimeService service = new ChimeService();

    @Test
    @DisplayName("candidates: listet beide erwarteten Kandidaten")
    void candidatesListsBoth() {
        List<String> cands = service.candidates();

        assertEquals(2, cands.size(), "exactly two candidates expected");
        assertTrue(cands.contains("sounds/doorbell.mp3"));
        assertTrue(cands.contains("sounds/doorbell.wav"));
    }

    @Test
    @DisplayName("playAsync: kehrt schnell zurück (nicht blockierend)")
    void playAsyncIsNonBlocking() {
        SoundSource bogus = new SoundSource("sounds/__missing__.mp3", true);

        long t0 = System.nanoTime();
        service.playAsync(bogus);
        long tookMs = (System.nanoTime() - t0) / 1_000_000L;

        assertTrue(tookMs < 100, "playAsync should return quickly, took=" + tookMs + "ms");
    }
}
