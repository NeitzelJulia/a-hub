package org.example.backend.service;

import org.example.backend.model.SoundSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class ChimeServiceResolveSourceTest {

    private static final String MP3_CP = "sounds/doorbell.mp3";
    private static final String WAV_CP = "sounds/doorbell.wav";

    static class FakeChimeService extends ChimeService {
        private final boolean mp3Exists;
        private final boolean wavExists;

        FakeChimeService(boolean mp3Exists, boolean wavExists) {
            this.mp3Exists = mp3Exists;
            this.wavExists = wavExists;
        }

        @Override
        boolean existsOnClasspath(String cpPath) {
            if (cpPath.endsWith("doorbell.mp3")) return mp3Exists;
            if (cpPath.endsWith("doorbell.wav")) return wavExists;
            return false;
        }
    }

    @Test
    @DisplayName("resolveSource: bevorzugt MP3, wenn MP3 und WAV vorhanden sind")
    void prefersMp3WhenBothExist() {
        ChimeService svc = new FakeChimeService(true, true);
        Optional<SoundSource> src = svc.resolveSource();
        assertTrue(src.isPresent());
        assertEquals(MP3_CP, src.get().classpath());
        assertTrue(src.get().mp3());
    }

    @Test
    @DisplayName("resolveSource: fällt auf WAV zurück, wenn nur WAV existiert")
    void fallsBackToWavWhenOnlyWavExists() {
        ChimeService svc = new FakeChimeService(false, true);
        Optional<SoundSource> src = svc.resolveSource();
        assertTrue(src.isPresent());
        assertEquals(WAV_CP, src.get().classpath());
        assertFalse(src.get().mp3());
    }

    @Test
    @DisplayName("resolveSource: empty, wenn weder MP3 noch WAV existieren")
    void emptyWhenNoneExists() {
        ChimeService svc = new FakeChimeService(false, false);
        Optional<SoundSource> src = svc.resolveSource();
        assertTrue(src.isEmpty());
    }
}
