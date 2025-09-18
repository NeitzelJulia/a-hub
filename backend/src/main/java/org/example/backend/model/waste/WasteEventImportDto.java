package org.example.backend.model.waste;

import java.time.LocalDate;


public record WasteEventImportDto(
        String uid,
        LocalDate dtstart,
        String summary,
        String description,
        WasteType type,
        String location
) {}
