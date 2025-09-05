package org.example.backend.service;

import javazoom.jl.player.Player;
import org.example.backend.model.SoundSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;

import javax.sound.sampled.*;
import java.io.InputStream;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChimeServicePlaybackTest {

    @Test
    @DisplayName("runPlayback(): MP3-Zweig -> Player.play() wird aufgerufen")
    void runPlayback_mp3_success() throws Exception {
        ChimeService service = new ChimeService();

        try (MockedConstruction<Player> mocked =
                     mockConstruction(Player.class, (mock, ctx) -> {
                         doNothing().when(mock).play();
                     })) {

            service.runPlayback(new SoundSource("sounds/doorbell.mp3", true));

            assertEquals(1, mocked.constructed().size());
            verify(mocked.constructed().getFirst(), times(1)).play();
        }
    }

    @Test
    @DisplayName("runPlayback(): WAV-Zweig -> Clip open/start/close, Listener zählt latch herunter")
    void runPlayback_wav_success() throws Exception {
        ChimeService service = new ChimeService();

        try (MockedStatic<AudioSystem> audioMock = mockStatic(AudioSystem.class)) {
            Clip clip = mock(Clip.class);
            AtomicReference<LineListener> listenerRef = new AtomicReference<>();
            doAnswer(inv -> { listenerRef.set(inv.getArgument(0)); return null; })
                    .when(clip).addLineListener(any());

            doNothing().when(clip).open(any(AudioInputStream.class));
            doAnswer(inv -> {
                LineListener l = listenerRef.get();
                if (l != null) {
                    Line dummy = mock(Line.class);
                    l.update(new LineEvent(dummy, LineEvent.Type.STOP, 0));
                }
                return null;
            }).when(clip).start();
            doNothing().when(clip).close();

            audioMock.when(AudioSystem::getClip).thenReturn(clip);

            AudioInputStream ais = mock(AudioInputStream.class);
            audioMock.when(() -> AudioSystem.getAudioInputStream(any(InputStream.class)))
                    .thenReturn(ais);

            service.runPlayback(new SoundSource("sounds/doorbell.wav", false));

            verify(clip, times(1)).addLineListener(any());
            verify(clip, times(1)).open(any(AudioInputStream.class));
            verify(clip, times(1)).start();
            verify(clip, times(1)).close();
        }
    }

    @Test
    @DisplayName("runPlayback(): InterruptedException setzt Interrupt-Flag (catch-Zweig)")
    void runPlayback_interrupted_setsFlag() throws Exception {
        ChimeService service = new ChimeService();

        try (MockedStatic<AudioSystem> audioMock = mockStatic(AudioSystem.class)) {
            Clip clip = mock(Clip.class);
            doNothing().when(clip).addLineListener(any());
            doNothing().when(clip).open(any(AudioInputStream.class));
            doNothing().when(clip).start();
            doNothing().when(clip).close();

            audioMock.when(AudioSystem::getClip).thenReturn(clip);
            AudioInputStream ais = mock(AudioInputStream.class);
            audioMock.when(() -> AudioSystem.getAudioInputStream(any(InputStream.class)))
                    .thenReturn(ais);

            assertFalse(Thread.currentThread().isInterrupted());
            Thread.currentThread().interrupt();

            service.runPlayback(new SoundSource("sounds/doorbell.wav", false));

            assertTrue(Thread.currentThread().isInterrupted(), "interrupt flag must remain set");

        } finally {
            Thread.interrupted();
        }
    }
}
