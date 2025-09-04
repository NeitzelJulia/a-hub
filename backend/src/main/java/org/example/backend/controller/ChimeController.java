package org.example.backend.controller;

import javazoom.jl.decoder.JavaLayerException;
import javazoom.jl.player.Player;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.sound.sampled.*;
import java.io.BufferedInputStream;
import java.io.InputStream;
import java.util.Map;
import java.util.concurrent.CountDownLatch;

@RestController
@RequestMapping("/api/chime")
public class ChimeController {

    private static final Logger log = LoggerFactory.getLogger(ChimeController.class);

    private static final String SOUND_DIR = "sounds/";
    private static final String MP3_NAME  = "doorbell.mp3";
    private static final String WAV_NAME  = "doorbell.wav";

    @PostMapping("/play")
    public ResponseEntity<Map<String, Object>> play() {
        final String cpPath;
        final boolean isMp3;
        ClassPathResource resMp3 = new ClassPathResource(SOUND_DIR + MP3_NAME);
        if (resMp3.exists()) {
            cpPath = SOUND_DIR + MP3_NAME;
            isMp3 = true;
        } else {
            ClassPathResource resWav = new ClassPathResource(SOUND_DIR + WAV_NAME);
            if (!resWav.exists()) {
                log.warn("Chime source not found in classpath: {} or {}", SOUND_DIR + MP3_NAME, SOUND_DIR + WAV_NAME);
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "not_found", "candidates", new String[]{SOUND_DIR + MP3_NAME, SOUND_DIR + WAV_NAME}));
            }
            cpPath = SOUND_DIR + WAV_NAME;
            isMp3 = false;
        }

        log.info("Chime play requested (classpath: {}, format: {})", cpPath, isMp3 ? "mp3" : "wav");

        Thread t = new Thread(() -> {
            try {
                if (isMp3) {
                    playMp3FromClasspath(cpPath);
                } else {
                    playWavFromClasspath(cpPath);
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

        return ResponseEntity.ok(Map.of("started", true, "source", cpPath));
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
