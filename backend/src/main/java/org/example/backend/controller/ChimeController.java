package org.example.backend.controller;

import org.example.backend.model.SoundSource;
import org.example.backend.service.ChimeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/chime")
public class ChimeController {

    private static final Logger log = LoggerFactory.getLogger(ChimeController.class);

    private final ChimeService chime;

    public ChimeController(ChimeService chime) {
        this.chime = chime;
    }

    @PostMapping("/play")
    public ResponseEntity<Map<String, Object>> play() {
        Optional<SoundSource> srcOpt = chime.resolveSource();
        if (srcOpt.isEmpty()) {
            log.warn("Chime source not found in classpath: {}", chime.candidates());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "not_found", "candidates", chime.candidates()));
        }

        SoundSource src = srcOpt.get();
        log.info("Chime play requested (classpath: {}, format: {})",
                src.classpath(), src.mp3() ? "mp3" : "wav");

        chime.playAsync(src);
        return ResponseEntity.ok(Map.of("started", true, "source", src.classpath()));
    }
}
