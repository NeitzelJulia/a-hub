package org.example.backend.repo;

import org.example.backend.model.doorbell.DoorbellEvent;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class DoorbellEventRepository {

    private final JdbcClient jdbc;

    public DoorbellEventRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public long createEvent(long nowMillis) {
        return jdbc.sql("""
                INSERT INTO doorbell_event (occurred_at, answered, talk_seconds)
                VALUES (?, 0, 0)
                RETURNING id
                """)
                .param(nowMillis)
                .query(Long.class)
                .single();
    }

    public Optional<DoorbellEvent> findById(long id) {
        return jdbc.sql("""
                SELECT
                  id,
                  occurred_at   AS occurredAtMillis,
                  answered      AS answered,
                  talk_seconds  AS talkSeconds
                FROM doorbell_event
                WHERE id = ?
                """)
                .param(id)
                .query(DoorbellEvent.class)
                .optional();
    }

    public List<DoorbellEvent> findLatest(int limit, int offset) {
        return jdbc.sql("""
                SELECT
                  id,
                  occurred_at   AS occurredAtMillis,
                  answered      AS answered,
                  talk_seconds  AS talkSeconds
                FROM doorbell_event
                ORDER BY occurred_at DESC
                LIMIT ? OFFSET ?
                """)
                .param(limit)
                .param(offset)
                .query(DoorbellEvent.class)
                .list();
    }

    public void markAnswered(long id) {
        jdbc.sql("UPDATE doorbell_event SET answered = 1 WHERE id = ?")
                .param(id)
                .update();
    }

    public void finalizeTalk(long id, int seconds) {
        jdbc.sql("UPDATE doorbell_event SET talk_seconds = ? WHERE id = ?")
                .param(Math.max(0, seconds))
                .param(id)
                .update();
    }
}
