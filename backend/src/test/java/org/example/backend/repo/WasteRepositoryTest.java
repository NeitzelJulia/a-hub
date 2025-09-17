package org.example.backend.repo;

import org.example.backend.model.waste.WasteEvent;
import org.example.backend.model.waste.WasteEventImportDto;
import org.example.backend.model.waste.WasteType;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@JdbcTest
@Import(WasteRepository.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class WasteRepositoryTest {

    @Autowired
    private WasteRepository repo;

    private static Path dbFile;

    @BeforeAll
    static void initDbFile() throws Exception {
        dbFile = Files.createTempFile("a-hub-it-waste", ".db");
    }

    @DynamicPropertySource
    static void dynamicProps(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> "jdbc:sqlite:" + dbFile.toAbsolutePath());
        r.add("spring.datasource.driver-class-name", () -> "org.sqlite.JDBC");
        r.add("spring.sql.init.mode", () -> "always");
        r.add("spring.sql.init.schema-locations", () -> "classpath:a-hub.sql");
        r.add("spring.datasource.hikari.maximum-pool-size", () -> "1");
    }

    @Test
    void create_and_readBack_viaRange() {
        var day = LocalDate.of(2025, 9, 22);
        var dto = new WasteEventImportDto("uid-1", day, "Gelbe Tonne", null, WasteType.PLASTIC, "Musterstraße 1");

        long id = repo.createWasteEvent(dto);
        assertTrue(id > 0);

        List<WasteEvent> list = repo.getWasteEventsInRange(day, day);
        assertEquals(1, list.size());

        WasteEvent e = list.getFirst();
        assertEquals(id, e.id());
        assertEquals("uid-1", e.uid());
        assertEquals(day, e.dtstart());
        assertEquals("Gelbe Tonne", e.summary());
        assertNull(e.description());
        assertEquals(WasteType.PLASTIC, e.type());
        assertEquals("Musterstraße 1", e.location());
    }

    @Test
    void importWasteEvents_batch_inserts_and_ordersByDateThenId() {
        var day = LocalDate.of(2025, 9, 22);

        var a = new WasteEventImportDto("u-a", day, "Gelbe Tonne", null, WasteType.PLASTIC, null);
        var b = new WasteEventImportDto("u-b", day, "Blaue Altpapiertonne", null, WasteType.PAPER, null);

        var ids = repo.importWasteEvents(List.of(a, b));
        assertEquals(2, ids.size());
        assertTrue(ids.get(0) > 0 && ids.get(1) > ids.get(0));

        var list = repo.getWasteEventsInRange(day, day);
        assertEquals(2, list.size());
        assertEquals(ids.get(0), list.get(0).id());
        assertEquals(ids.get(1), list.get(1).id());
        assertEquals("Gelbe Tonne", list.get(0).summary());
        assertEquals("Blaue Altpapiertonne", list.get(1).summary());
    }

    @Test
    void clearWasteEvents_emptiesTable() {
        var d1 = new WasteEventImportDto("u1", LocalDate.of(2025, 9, 18), "Restmüll", null, WasteType.RESIDUAL, null);
        var d2 = new WasteEventImportDto("u2", LocalDate.of(2025, 9, 19), "Gelbe Tonne", null, WasteType.PLASTIC, null);
        repo.importWasteEvents(List.of(d1, d2));

        assertFalse(repo.getWasteEventsInRange(LocalDate.of(2025, 9, 1), LocalDate.of(2025, 9, 30)).isEmpty());

        repo.clearWasteEvents();

        assertTrue(repo.getWasteEventsInRange(LocalDate.of(2025, 9, 1), LocalDate.of(2025, 9, 30)).isEmpty());
    }

    @Test
    void getWasteEventsInRange_isInclusive_onBothEnds() {
        var a = new WasteEventImportDto("a", LocalDate.of(2025, 9, 18), "Restmüll", null, WasteType.RESIDUAL, null);
        var b = new WasteEventImportDto("b", LocalDate.of(2025, 9, 19), "Papier", null, WasteType.PAPER, null);
        var c = new WasteEventImportDto("c", LocalDate.of(2025, 9, 20), "Gelbe Tonne", null, WasteType.PLASTIC, null);
        repo.importWasteEvents(List.of(a, b, c));

        var all = repo.getWasteEventsInRange(LocalDate.of(2025, 9, 18), LocalDate.of(2025, 9, 20));
        assertEquals(3, all.size());

        var mid = repo.getWasteEventsInRange(LocalDate.of(2025, 9, 19), LocalDate.of(2025, 9, 20));
        assertEquals(2, mid.size());
        assertEquals(LocalDate.of(2025, 9, 19), mid.get(0).dtstart());
        assertEquals(LocalDate.of(2025, 9, 20), mid.get(1).dtstart());

        var edge = repo.getWasteEventsInRange(LocalDate.of(2025, 9, 18), LocalDate.of(2025, 9, 18));
        assertEquals(1, edge.size());
        assertEquals("Restmüll", edge.getFirst().summary());
    }
}
