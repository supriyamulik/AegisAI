"""
AegisAI Audit Logging Service
──────────────────────────────
Immutable, tamper-evident audit trail with SHA-256 checksums.
Append-only structure — records cannot be modified.
"""

import hashlib
import json
import uuid
from datetime import datetime
from database import get_db_connection


class AuditLogger:
    """
    Append-only audit logger with tamper detection.
    Each record contains a SHA-256 checksum of its content
    to detect unauthorized modifications.
    """

    def log(
        self,
        event_id: str,
        action: str,
        timestamp: str,
        model_id: str = None,
        actor: str = "system",
        details: dict = None,
    ) -> str:
        """
        Append an audit record. Returns the record checksum.

        The checksum covers: event_id + model_id + action + actor + details + timestamp
        This makes any tampering with these fields detectable.
        """
        details_str = json.dumps(details or {}, sort_keys=True)

        # Compute tamper-evident checksum
        checksum_input = f"{event_id}|{model_id}|{action}|{actor}|{details_str}|{timestamp}"
        checksum = hashlib.sha256(checksum_input.encode()).hexdigest()

        with get_db_connection() as conn:
            conn.execute("""
                INSERT INTO audit_log
                  (event_id, model_id, action, actor, details, checksum, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                event_id, model_id, action, actor,
                details_str, checksum, timestamp
            ))
            conn.commit()

        return checksum

    def verify_integrity(self, record_id: int) -> dict:
        """
        Verify a specific audit record has not been tampered with.
        Returns verification result with pass/fail and details.
        """
        with get_db_connection() as conn:
            row = conn.execute(
                "SELECT * FROM audit_log WHERE id = ?", (record_id,)
            ).fetchone()

        if not row:
            return {"valid": False, "reason": "Record not found"}

        row = dict(row)
        checksum_input = (
            f"{row['event_id']}|{row['model_id']}|{row['action']}|"
            f"{row['actor']}|{row['details']}|{row['timestamp']}"
        )
        expected = hashlib.sha256(checksum_input.encode()).hexdigest()
        is_valid = expected == row["checksum"]

        return {
            "record_id": record_id,
            "valid": is_valid,
            "stored_checksum": row["checksum"],
            "computed_checksum": expected,
            "reason": "Integrity verified" if is_valid else "TAMPER DETECTED — checksum mismatch"
        }

    def query_trail(self, model_id: str = None, action_filter: str = None, limit: int = 100) -> list:
        """
        Query the audit trail with optional filters.
        """
        conditions = []
        params = []

        if model_id:
            conditions.append("model_id = ?")
            params.append(model_id)
        if action_filter:
            conditions.append("action LIKE ?")
            params.append(f"%{action_filter}%")

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.append(limit)

        with get_db_connection() as conn:
            rows = conn.execute(
                f"SELECT * FROM audit_log {where_clause} ORDER BY timestamp DESC LIMIT ?",
                params
            ).fetchall()

        return [dict(r) for r in rows]
