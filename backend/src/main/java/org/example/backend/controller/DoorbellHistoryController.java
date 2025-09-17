package org.example.backend.controller;

import org.example.backend.model.doorbell.DoorbellEvent;
import org.example.backend.model.doorbell.DoorbellEventCreateResponseDto;
import org.example.backend.model.doorbell.DoorbellEventFinishRequestDto;
import org.example.backend.service.DoorbellHistoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/history")
public class DoorbellHistoryController {

    private final DoorbellHistoryService service;

    public DoorbellHistoryController(DoorbellHistoryService service) {
        this.service = service;
    }

    @PostMapping("/events")
    public DoorbellEventCreateResponseDto create() {
        var saved = service.createEvent();
        return new DoorbellEventCreateResponseDto(saved.id(), saved.occurredAtMillis());
    }

    @PatchMapping("/events/{id}/answered")
    public ResponseEntity<Void> answered(@PathVariable long id) {
        service.markAnswered(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/events/{id}/finish")
    public ResponseEntity<Void> finish(@PathVariable long id,
                                       @RequestBody DoorbellEventFinishRequestDto body) {
        service.finish(id, Math.max(0, body.talkSeconds()));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/events")
    public List<DoorbellEvent> list(@RequestParam(defaultValue = "50") int limit,
                                    @RequestParam(defaultValue = "0") int offset) {
        return service.latest(limit, offset);
    }

    @GetMapping("/events/{id}")
    public ResponseEntity<DoorbellEvent> get(@PathVariable long id) {
        var e = service.get(id);
        return e == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(e);
    }
}
