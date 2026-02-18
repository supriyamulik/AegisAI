"""
AegisAI Database Layer — SQLite (MVP) / PostgreSQL-compatible schema
"""

import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent / "aegisai.db"


def init_db():
    """Initialize all tables."""
    with get_db_connection() as conn:
        conn.executescript("""
            -- ─────────────────────────────────────────────
            -- MODELS REGISTRY
            -- ─────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS models (
                id              TEXT PRIMARY KEY,
                name            TEXT NOT NULL,
                model_type      TEXT NOT NULL CHECK(model_type IN ('ml', 'llm')),
                business_unit   TEXT,
                owner           TEXT,
                environment     TEXT DEFAULT 'production',
                status          TEXT DEFAULT 'active',
                registered_at   TEXT NOT NULL,
                metadata        TEXT  -- JSON blob
            );

            -- ─────────────────────────────────────────────
            -- RAW RISK EVENTS (append-only telemetry log)
            -- ─────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS risk_events (
                id                TEXT PRIMARY KEY,
                model_id          TEXT NOT NULL,
                model_type        TEXT NOT NULL,
                event_type        TEXT NOT NULL,
                raw_payload       TEXT NOT NULL,  -- JSON
                normalized_scores TEXT NOT NULL,  -- JSON
                timestamp         TEXT NOT NULL
            );

            -- ─────────────────────────────────────────────
            -- UNIFIED SCORES (current state per model)
            -- ─────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS unified_scores (
                model_id          TEXT PRIMARY KEY,
                risk_index        REAL NOT NULL,
                risk_level        TEXT NOT NULL,
                component_scores  TEXT NOT NULL,  -- JSON
                timestamp         TEXT NOT NULL
            );

            -- ─────────────────────────────────────────────
            -- SCORE HISTORY (time-series for trend analysis)
            -- ─────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS score_history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                model_id    TEXT NOT NULL,
                risk_index  REAL NOT NULL,
                risk_level  TEXT NOT NULL,
                timestamp   TEXT NOT NULL
            );

            -- ─────────────────────────────────────────────
            -- GOVERNANCE ACTIONS
            -- ─────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS governance_actions (
                id                  TEXT PRIMARY KEY,
                model_id            TEXT NOT NULL,
                action_type         TEXT NOT NULL,
                reason              TEXT,
                triggered_by_risk   REAL,
                status              TEXT DEFAULT 'executed',
                resolved_by         TEXT,
                resolved_at         TEXT,
                timestamp           TEXT NOT NULL
            );

            -- ─────────────────────────────────────────────
            -- AUDIT LOG (immutable, append-only)
            -- ─────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS audit_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id    TEXT NOT NULL,
                model_id    TEXT,
                action      TEXT NOT NULL,
                actor       TEXT DEFAULT 'system',
                details     TEXT,  -- JSON
                checksum    TEXT,  -- SHA256 of row content for tamper detection
                timestamp   TEXT NOT NULL
            );

            -- Indexes for query performance
            CREATE INDEX IF NOT EXISTS idx_risk_events_model ON risk_events(model_id);
            CREATE INDEX IF NOT EXISTS idx_score_history_model ON score_history(model_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_governance_model ON governance_actions(model_id);
            CREATE INDEX IF NOT EXISTS idx_audit_model ON audit_log(model_id);
            CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
        """)
        conn.commit()


@contextmanager
def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")  # Better concurrent read performance
    try:
        yield conn
    finally:
        conn.close()
