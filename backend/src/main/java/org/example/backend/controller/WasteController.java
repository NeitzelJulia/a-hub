package org.example.backend.controller;

import org.example.backend.service.WasteImportService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/waste")
public class WasteController {

    private final WasteImportService importService;

    public WasteController(WasteImportService importService) {
        this.importService = importService;
    }

    @PostMapping("/import")
    public Map<String, Object> importFromResources(@RequestParam(required = false) String resource) {
        int inserted = importService.importIcs(resource);
        return Map.of("inserted", inserted);
    }
}
