package org.example.backend.model.doorbell;

public record DoorbellEvent(
        Long id,
        Long occurredAtMillis,
        Boolean answered,
        Integer talkSeconds
) {}
