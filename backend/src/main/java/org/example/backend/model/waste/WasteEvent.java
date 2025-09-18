package org.example.backend.model.waste;

import java.time.LocalDate;

public record WasteEvent(
        long id,
        String uid,
        LocalDate dtstart,
        String summary,
        String description,
        WasteType type,
        String location
) {}