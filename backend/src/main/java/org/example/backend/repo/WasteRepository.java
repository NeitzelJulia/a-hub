package org.example.backend.repo;

import org.example.backend.model.waste.WasteEventImportDto;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;

@Repository
public class WasteRepository {

    private final JdbcClient jdbc;

    public WasteRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public long createWasteEvent(WasteEventImportDto dto) {
        return jdbc.sql("""
            INSERT INTO waste_event (uid, dtstart, summary, description, type, location)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING id
            """).param(dto.uid())
                .param(dto.dtstart().toString())
                .param(dto.summary())
                .param(dto.description())
                .param(dto.type().name())
                .param(dto.location())
                .query(Long.class)
                .single();
    }

    public List<Long> importWasteEvents(List<WasteEventImportDto> dtoList){
        var ids = new ArrayList<Long>();
        for(WasteEventImportDto dto : dtoList){
            ids.add(createWasteEvent(dto));
        }
        return ids;
    }

    public void clearWasteEvents() {
        jdbc.sql("DELETE FROM waste_event").update();
    }
}
