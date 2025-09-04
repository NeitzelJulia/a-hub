package org.example.backend.service;

import javazoom.jl.decoder.JavaLayerException;
import javazoom.jl.player.Player;
import org.example.backend.model.SoundSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import javax.sound.sampled.*;
import java.io.BufferedInputStream;
import java.io.InputStream;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;

@Service
public class ChimeService {

    private static final Logger log = LoggerFactory.getLogger(ChimeService.class);

    private static final String SOUND_DIR = "sounds/";
    private static final String MP3_NAME  = "doorbell.mp3";
    private static final String WAV_NAME  = "doorbell.wav";

    public Optional<SoundSource> resolveSource() {
        ClassPathResource mp3 = new ClassPathResource(SOUND_DIR + MP3_NAME);
        if (mp3.exists()) {
            return Optional.of(new SoundSource(SOUND_DIR + MP3_NAME, true));
        }
        ClassPathResource wav = new ClassPathResource(SOUND_DIR + WAV_NAME);
        if (wav.exists()) {
            return Optional.of(new SoundSource(SOUND_DIR + WAV_NAME, false));
        }
        return Optional.empty();
    }

    public List<String> candidates() {
        return List.of(SOUND_DIR + MP3_NAME, SOUND_DIR + WAV_NAME);
    }

    public void playAsync(SoundSource src) {
        Thread t = new Thread(() -> {
            try {
                if (src.mp3()) {
                    playMp3FromClasspath(src.classpath());
                } else {
                    playWavFromClasspath(src.classpath());
                }
                log.debug("Chime playback finished");
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                log.warn("Chime playback interrupted", ie);
            } catch (java.io.IOException
                     | JavaLayerException
                     | UnsupportedAudioFileException
                     | LineUnavailableException e) {
                log.error("Chime playback failed", e);
            }
        }, "chime-player");
        t.setDaemon(true);
        t.start();
    }

    /* ---------------- WAV (Java Sound) ---------------- */

    private void playWavFromClasspath(String cpPath)
            throws java.io.IOException, UnsupportedAudioFileException,
            LineUnavailableException, InterruptedException {
        ClassPathResource res = new ClassPathResource(cpPath);
        try (InputStream in = res.getInputStream();
             AudioInputStream ais = AudioSystem.getAudioInputStream(in)) {
            playClip(ais);
        }
    }

    private void playClip(AudioInputStream ais)
            throws LineUnavailableException, java.io.IOException, InterruptedException {
        Clip clip = AudioSystem.getClip();
        CountDownLatch done = new CountDownLatch(1);
        try {
            clip.addLineListener(ev -> {
                if (ev.getType() == LineEvent.Type.STOP || ev.getType() == LineEvent.Type.CLOSE) {
                    done.countDown();
                }
            });
            clip.open(ais);
            clip.start();
            done.await();
        } finally {
            try {
                clip.close();
            } catch (Exception e) {
                log.debug("clip close ignored", e);
            }
        }
    }

    /* ---------------- MP3 (JLayer) ---------------- */

    private void playMp3FromClasspath(String cpPath)
            throws java.io.IOException, JavaLayerException {
        ClassPathResource res = new ClassPathResource(cpPath);
        try (InputStream in = res.getInputStream();
             BufferedInputStream bin = new BufferedInputStream(in)) {
            new Player(bin).play();
        }
    }
}
