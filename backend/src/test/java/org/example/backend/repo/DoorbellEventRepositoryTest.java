package org.example.backend.repo;

import org.example.backend.model.doorbell.DoorbellEvent;
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
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@JdbcTest
@Import(DoorbellEventRepository.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class DoorbellEventRepositoryTest {

    @Autowired
    private DoorbellEventRepository repo;

    private static Path dbFile;

    @BeforeAll
    static void initDbFile() throws Exception {
        dbFile = Files.createTempFile("a-hub-it", ".db");
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
    void createEvent_and_findById() {
        long now = 1_700_000_000_000L;
        long id = repo.createEvent(now);

        assertTrue(id > 0);

        var opt = repo.findById(id);
        assertTrue(opt.isPresent());

        DoorbellEvent e = opt.get();
        assertEquals(id, e.id());
        assertEquals(now, e.occurredAtMillis());
        assertEquals(Boolean.FALSE, e.answered());
        assertEquals(0, e.talkSeconds());
    }

    @Test
    void findById_notFound() {
        assertTrue(repo.findById(999_999L).isEmpty());
    }

    @Test
    void markAnswered_updatesFlag() {
        long id = repo.createEvent(1111L);
        assertFalse(repo.findById(id).orElseThrow().answered());

        repo.markAnswered(id);

        assertTrue(repo.findById(id).orElseThrow().answered());
    }

    @Test
    void finalizeTalk_setsSeconds_and_clamps() {
        long id = repo.createEvent(2222L);

        repo.finalizeTalk(id, 12);
        assertEquals(12, repo.findById(id).orElseThrow().talkSeconds());

        repo.finalizeTalk(id, -5);
        assertEquals(0, repo.findById(id).orElseThrow().talkSeconds());
    }

    @Test
    void findLatest_ordering_and_paging() {
        long id1 = repo.createEvent(1000L);
        long id2 = repo.createEvent(2000L);
        long id3 = repo.createEvent(3000L);

        List<DoorbellEvent> page1 = repo.findLatest(2, 0);
        assertEquals(2, page1.size());
        assertEquals(id3, page1.get(0).id());
        assertEquals(3000L, page1.get(0).occurredAtMillis());
        assertEquals(id2, page1.get(1).id());
        assertEquals(2000L, page1.get(1).occurredAtMillis());

        List<DoorbellEvent> page2 = repo.findLatest(2, 2);
        assertEquals(1, page2.size());
        assertEquals(id1, page2.getFirst().id());
        assertEquals(1000L, page2.getFirst().occurredAtMillis());

        assertTrue(repo.findLatest(5, 3).isEmpty());
    }
}
