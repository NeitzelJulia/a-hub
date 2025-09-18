PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

CREATE TABLE IF NOT EXISTS doorbell_event (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at   INTEGER NOT NULL,
    answered      INTEGER NOT NULL DEFAULT 0,
    talk_seconds  INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_event_time ON doorbell_event (occurred_at DESC);

CREATE TABLE IF NOT EXISTS waste_event (
                                           id           INTEGER PRIMARY KEY AUTOINCREMENT,
                                           uid          TEXT NOT NULL,
                                           dtstart      TEXT NOT NULL,
                                           summary      TEXT NOT NULL,
                                           description  TEXT,
                                           type         TEXT NOT NULL,
                                           location     TEXT
);

CREATE INDEX IF NOT EXISTS idx_waste_dtstart ON waste_event (dtstart);