"""
AegisAI Demo Seed Data
─────────────────────
Populates the database with realistic banking AI model scenarios
for demonstration purposes.
"""

import json
import uuid
from datetime import datetime, timedelta
import random
from database import get_db_connection


DEMO_MODELS = [
    {
        "id": "credit-scoring-v3",
        "name": "Credit Scoring Model v3",
        "model_type": "ml",
        "business_unit": "Retail Lending",
        "owner": "Model Risk Team",
        "environment": "production",
        "status": "active",
        # Risk scenario: moderate drift, elevated bias
        "risk_index": 58.4,
        "risk_level": "moderate",
        "components": {
            "drift_score": 0.45,
            "bias_score": 0.52,
            "prediction_instability": 0.28,
            "data_quality_score": 0.15
        }
    },
    {
        "id": "fraud-detection-v7",
        "name": "Fraud Detection v7",
        "model_type": "ml",
        "business_unit": "Payments & Risk",
        "owner": "Fraud Analytics",
        "environment": "production",
        "status": "active",
        # Risk scenario: low risk, well-maintained model
        "risk_index": 18.2,
        "risk_level": "low",
        "components": {
            "drift_score": 0.12,
            "bias_score": 0.18,
            "prediction_instability": 0.09,
            "data_quality_score": 0.07
        }
    },
    {
        "id": "loan-advisor-llm-v2",
        "name": "Loan Advisor LLM v2",
        "model_type": "llm",
        "business_unit": "Digital Banking",
        "owner": "AI Products Team",
        "environment": "production",
        "status": "active",
        # Risk scenario: high hallucination + injection risk
        "risk_index": 74.1,
        "risk_level": "high",
        "components": {
            "hallucination_score": 0.62,
            "toxicity_score": 0.18,
            "prompt_injection_risk": 0.71,
            "data_leakage_risk": 0.29
        }
    },
    {
        "id": "kyc-screening-ml",
        "name": "KYC Document Screening",
        "model_type": "ml",
        "business_unit": "Compliance",
        "owner": "RegTech Team",
        "environment": "production",
        "status": "active",
        # Risk scenario: critical bias — frozen
        "risk_index": 83.7,
        "risk_level": "critical",
        "components": {
            "drift_score": 0.38,
            "bias_score": 0.91,
            "prediction_instability": 0.44,
            "data_quality_score": 0.62
        }
    },
    {
        "id": "wealth-advisor-gpt",
        "name": "Wealth Advisory Chatbot",
        "model_type": "llm",
        "business_unit": "Private Banking",
        "owner": "AI Products Team",
        "environment": "production",
        "status": "active",
        # Risk scenario: moderate across all dimensions
        "risk_index": 41.9,
        "risk_level": "moderate",
        "components": {
            "hallucination_score": 0.38,
            "toxicity_score": 0.12,
            "prompt_injection_risk": 0.33,
            "data_leakage_risk": 0.44
        }
    },
    {
        "id": "aml-transaction-v4",
        "name": "AML Transaction Monitor v4",
        "model_type": "ml",
        "business_unit": "Financial Crime",
        "owner": "AML Analytics",
        "environment": "production",
        "status": "active",
        # Risk scenario: low risk
        "risk_index": 22.6,
        "risk_level": "low",
        "components": {
            "drift_score": 0.19,
            "bias_score": 0.21,
            "prediction_instability": 0.14,
            "data_quality_score": 0.11
        }
    },
]


def seed_demo_data():
    """Seed all demo models with historical score data."""
    now = datetime.utcnow()

    with get_db_connection() as conn:
        # Check if already seeded
        existing = conn.execute("SELECT COUNT(*) FROM unified_scores").fetchone()[0]
        if existing > 0:
            return  # Already seeded

        # Seed models table
        for model in DEMO_MODELS:
            conn.execute("""
                INSERT OR IGNORE INTO models
                  (id, name, model_type, business_unit, owner, environment, status, registered_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                model["id"], model["name"], model["model_type"],
                model["business_unit"], model["owner"],
                model["environment"], model["status"],
                (now - timedelta(days=random.randint(30, 365))).isoformat()
            ))

        # Seed current unified scores
        for model in DEMO_MODELS:
            conn.execute("""
                INSERT OR REPLACE INTO unified_scores
                  (model_id, risk_index, risk_level, component_scores, timestamp)
                VALUES (?, ?, ?, ?, ?)
            """, (
                model["id"],
                model["risk_index"],
                model["risk_level"],
                json.dumps(model["components"]),
                now.isoformat()
            ))

        # Seed 30 days of historical score data (one reading per day per model)
        for model in DEMO_MODELS:
            base_risk = model["risk_index"]
            for days_ago in range(30, 0, -1):
                ts = now - timedelta(days=days_ago)
                # Simulate realistic trend: slight random walk
                variation = random.gauss(0, 4)
                trend_factor = (30 - days_ago) / 30  # Trend toward current value
                historical_risk = max(0, min(100,
                    base_risk * (1 - trend_factor) +
                    base_risk * trend_factor +
                    variation
                ))
                conn.execute("""
                    INSERT INTO score_history (model_id, risk_index, risk_level, timestamp)
                    VALUES (?, ?, ?, ?)
                """, (
                    model["id"],
                    round(historical_risk, 1),
                    _classify_level(historical_risk),
                    ts.isoformat()
                ))

        # Seed governance actions for high/critical models
        governance_scenarios = [
            {
                "model_id": "kyc-screening-ml",
                "action_type": "freeze_model",
                "reason": "Unified Risk Index exceeded critical threshold (83.7). Frozen pending bias fairness audit (ECOA compliance).",
                "triggered_by_risk": 83.7,
                "status": "executed",
                "days_ago": 2
            },
            {
                "model_id": "loan-advisor-llm-v2",
                "action_type": "escalate_to_human",
                "reason": "High prompt injection risk (0.71) detected. Model risk team notified.",
                "triggered_by_risk": 74.1,
                "status": "pending_review",
                "days_ago": 1
            },
            {
                "model_id": "kyc-screening-ml",
                "action_type": "freeze_model",
                "reason": "Bias score 0.91 — ECOA demographic parity violation. Immediate freeze.",
                "triggered_by_risk": 83.7,
                "status": "executed",
                "days_ago": 2
            },
            {
                "model_id": "credit-scoring-v3",
                "action_type": "send_alert",
                "reason": "Moderate drift (0.45) observed. Monitoring increased per SR 11-7.",
                "triggered_by_risk": 58.4,
                "status": "executed",
                "days_ago": 3
            },
            {
                "model_id": "loan-advisor-llm-v2",
                "action_type": "enable_strict_filtering",
                "reason": "High prompt injection activity (71% risk score). Strict input filtering activated.",
                "triggered_by_risk": 74.1,
                "status": "executed",
                "days_ago": 1
            },
        ]

        for g in governance_scenarios:
            action_ts = now - timedelta(days=g["days_ago"])
            conn.execute("""
                INSERT INTO governance_actions
                  (id, model_id, action_type, reason, triggered_by_risk, status, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                str(uuid.uuid4()),
                g["model_id"], g["action_type"], g["reason"],
                g["triggered_by_risk"], g["status"],
                action_ts.isoformat()
            ))

        # Seed audit log entries
        audit_entries = [
            ("system", "ml_metrics_ingested", "kyc-screening-ml", {"risk_index": 83.7, "level": "critical"}),
            ("system", "governance_freeze_model", "kyc-screening-ml", {"action": "freeze_model", "severity": "critical"}),
            ("system", "llm_metrics_ingested", "loan-advisor-llm-v2", {"risk_index": 74.1, "level": "high"}),
            ("system", "governance_escalate_to_human", "loan-advisor-llm-v2", {"action": "escalate", "severity": "high"}),
            ("system", "ml_metrics_ingested", "credit-scoring-v3", {"risk_index": 58.4, "level": "moderate"}),
            ("admin", "model_registered", "aml-transaction-v4", {"action": "registration"}),
            ("system", "governance_send_alert", "credit-scoring-v3", {"action": "alert", "severity": "moderate"}),
        ]

        import hashlib
        for i, (actor, action, mid, details) in enumerate(audit_entries):
            event_id = str(uuid.uuid4())
            ts = (now - timedelta(hours=i * 3)).isoformat()
            details_str = json.dumps(details, sort_keys=True)
            checksum_input = f"{event_id}|{mid}|{action}|{actor}|{details_str}|{ts}"
            checksum = hashlib.sha256(checksum_input.encode()).hexdigest()
            conn.execute("""
                INSERT INTO audit_log (event_id, model_id, action, actor, details, checksum, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (event_id, mid, action, actor, details_str, checksum, ts))

        conn.commit()
    print("✅ Demo data seeded — 6 models, 30-day history, governance actions, audit trail.")


def _classify_level(score: float) -> str:
    if score <= 30:
        return "low"
    if score <= 60:
        return "moderate"
    if score <= 80:
        return "high"
    return "critical"
