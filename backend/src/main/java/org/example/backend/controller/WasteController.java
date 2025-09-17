package org.example.backend.controller;

import org.example.backend.model.waste.WasteNextDto;
import org.example.backend.service.WasteService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/waste")
public class WasteController {

    private final WasteService importService;

    public WasteController(WasteService importService) {
        this.importService = importService;
    }

    @GetMapping("/range")
    public List<WasteNextDto> range(
            @RequestParam("date")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(name = "days") int days
    ) {
        return importService.getDtosInWindow(date, days);
    }

    @PostMapping("/import")
    public Map<String, Object> importFromResources(@RequestParam(required = false) String resource) {
        int inserted = importService.importIcs(resource);
        return Map.of("inserted", inserted);
    }
}
