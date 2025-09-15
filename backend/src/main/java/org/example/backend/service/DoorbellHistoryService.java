package org.example.backend.service;

import org.example.backend.model.doorbell.DoorbellEvent;
import org.example.backend.repo.DoorbellEventRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DoorbellHistoryService {
    private final DoorbellEventRepository repo;

    public DoorbellHistoryService(DoorbellEventRepository repo) { this.repo = repo; }

    public DoorbellEvent createEvent() {
        long id = repo.createEvent(System.currentTimeMillis());
        return repo.findById(id).orElse(new DoorbellEvent(id, null, null, null));
    }

    public void markAnswered(long id) {
        repo.markAnswered(id);
    }

    public void finish(long id, int talkSeconds) {
        repo.finalizeTalk(id, talkSeconds);
    }

    public List<DoorbellEvent> latest(int limit, int offset) {
        return repo.findLatest(limit, offset);
    }

    public DoorbellEvent get(long id) {
        return repo.findById(id).orElse(null);
    }
}
