"""
AegisAI – Working Demo Backend
Simple FastAPI with realistic data that changes over time
No WebSockets - just a working API with evolving data
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import uuid
import json
import random
import threading
import time

from database import init_db, get_db_connection
from models import MLMetricsPayload, LLMMetricsPayload, RiskScoreResponse
from risk_engine import RiskNormalizationEngine, RiskAggregationEngine, RiskForecaster
from policy_engine import PolicyEngine
from audit_service import AuditLogger

app = FastAPI(
    title="AegisAI – Working Demo",
    description="AI risk monitoring with realistic evolving data",
    version="2.0-demo"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
risk_normalizer = RiskNormalizationEngine()
risk_aggregator = RiskAggregationEngine()
policy_engine = PolicyEngine()
audit_logger = AuditLogger()
forecaster = RiskForecaster()


@app.on_event("startup")
async def startup_event():
    init_db()
    from seed_data import seed_demo_data
    seed_demo_data()
    print("✅ AegisAI initialized — database ready with demo data")
    
    # Start background thread to evolve data
    thread = threading.Thread(target=background_data_evolution, daemon=True)
    thread.start()
    print("🔄 Background data evolution started (models will change over time)")


# ─────────────────────────────────────────────
# BACKGROUND DATA EVOLUTION
# ─────────────────────────────────────────────

def background_data_evolution():
    """
    Continuously evolves model risk scores to simulate real-world drift.
    Runs in background thread, updates database every 45 seconds.
    """
    while True:
        try:
            time.sleep(45)  # Update every 45 seconds
            
            with get_db_connection() as conn:
                models = conn.execute(
                    "SELECT model_id, risk_index FROM unified_scores"
                ).fetchall()
            
            for model in models:
                model_id = model["model_id"]
                current_risk = model["risk_index"]
                
                # Add realistic drift: small random walk
                drift = random.gauss(0, 2.5)  # Mean=0, StdDev=2.5
                
                # Slight upward bias (risk tends to increase over time)
                bias = random.uniform(-0.2, 0.8)
                
                new_risk = max(0, min(100, current_risk + drift + bias))
                new_level = classify_risk_level(new_risk)
                
                # Get current component scores
                with get_db_connection() as conn:
                    row = conn.execute(
                        "SELECT component_scores FROM unified_scores WHERE model_id = ?",
                        (model_id,)
                    ).fetchone()
                    
                    components = json.loads(row["component_scores"])
                    
                    # Evolve each component slightly
                    for key in components:
                        old_val = components[key]
                        component_drift = random.gauss(0, 0.02)
                        components[key] = max(0, min(1, old_val + component_drift))
                
                # Update database
                timestamp = datetime.utcnow().isoformat()
                with get_db_connection() as conn:
                    conn.execute("""
                        UPDATE unified_scores 
                        SET risk_index = ?, risk_level = ?, component_scores = ?, timestamp = ?
                        WHERE model_id = ?
                    """, (new_risk, new_level, json.dumps(components), timestamp, model_id))
                    
                    # Add to history
                    conn.execute("""
                        INSERT INTO score_history (model_id, risk_index, risk_level, timestamp)
                        VALUES (?, ?, ?, ?)
                    """, (model_id, new_risk, new_level, timestamp))
                    
                    # Check if governance needed
                    if new_risk >= 81 and current_risk < 81:
                        # Crossed into critical
                        action_id = str(uuid.uuid4())
                        conn.execute("""
                            INSERT INTO governance_actions
                              (id, model_id, action_type, reason, triggered_by_risk, timestamp)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (
                            action_id, model_id, "freeze_model",
                            f"Risk crossed critical threshold: {new_risk:.1f}",
                            new_risk, timestamp
                        ))
                        print(f"⚠️  GOVERNANCE TRIGGERED: {model_id} frozen at risk {new_risk:.1f}")
                    
                    elif new_risk >= 61 and current_risk < 61:
                        # Crossed into high
                        action_id = str(uuid.uuid4())
                        conn.execute("""
                            INSERT INTO governance_actions
                              (id, model_id, action_type, reason, triggered_by_risk, timestamp)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (
                            action_id, model_id, "escalate_to_human",
                            f"Risk elevated to high zone: {new_risk:.1f}",
                            new_risk, timestamp
                        ))
                        print(f"⚠️  GOVERNANCE: {model_id} escalated at risk {new_risk:.1f}")
                    
                    conn.commit()
            
            print(f"📊 Data evolved at {datetime.utcnow().strftime('%H:%M:%S')}")
            
        except Exception as e:
            print(f"Error in background evolution: {e}")
            time.sleep(5)


def classify_risk_level(score: float) -> str:
    if score <= 30: return "low"
    if score <= 60: return "moderate"
    if score <= 80: return "high"
    return "critical"


# ─────────────────────────────────────────────
# INGESTION ENDPOINTS
# ─────────────────────────────────────────────

@app.post("/ingest/ml-metrics", summary="Ingest ML model telemetry")
async def ingest_ml_metrics(payload: MLMetricsPayload, background_tasks: BackgroundTasks):
    event_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat()

    normalized = risk_normalizer.normalize_ml_metrics(payload.dict())
    risk_scores = risk_aggregator.compute_ml_risk(normalized)

    with get_db_connection() as conn:
        conn.execute("""
            INSERT INTO risk_events
              (id, model_id, model_type, event_type, raw_payload, normalized_scores, timestamp)
            VALUES (?, ?, 'ml', 'metrics_ingestion', ?, ?, ?)
        """, (
            event_id, payload.model_id,
            json.dumps(payload.dict()),
            json.dumps(normalized),
            timestamp
        ))

        conn.execute("""
            INSERT INTO unified_scores (model_id, risk_index, risk_level, component_scores, timestamp)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(model_id) DO UPDATE SET
              risk_index=excluded.risk_index,
              risk_level=excluded.risk_level,
              component_scores=excluded.component_scores,
              timestamp=excluded.timestamp
        """, (
            payload.model_id,
            risk_scores["unified_risk_index"],
            risk_scores["risk_level"],
            json.dumps(risk_scores["components"]),
            timestamp
        ))
        
        conn.execute("""
            INSERT INTO score_history (model_id, risk_index, risk_level, timestamp)
            VALUES (?, ?, ?, ?)
        """, (payload.model_id, risk_scores["unified_risk_index"], risk_scores["risk_level"], timestamp))
        
        conn.commit()

    # Run governance
    background_tasks.add_task(
        run_governance_pipeline,
        payload.model_id, risk_scores, event_id, timestamp
    )

    audit_logger.log(
        event_id=event_id, model_id=payload.model_id,
        action="ml_metrics_ingested", details=risk_scores, timestamp=timestamp
    )

    return {
        "status": "accepted",
        "event_id": event_id,
        "model_id": payload.model_id,
        "unified_risk_index": risk_scores["unified_risk_index"],
        "risk_level": risk_scores["risk_level"],
        "timestamp": timestamp
    }


@app.post("/ingest/llm-metrics", summary="Ingest LLM telemetry")
async def ingest_llm_metrics(payload: LLMMetricsPayload, background_tasks: BackgroundTasks):
    event_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat()

    normalized = risk_normalizer.normalize_llm_metrics(payload.dict())
    risk_scores = risk_aggregator.compute_llm_risk(normalized)

    with get_db_connection() as conn:
        conn.execute("""
            INSERT INTO risk_events
              (id, model_id, model_type, event_type, raw_payload, normalized_scores, timestamp)
            VALUES (?, ?, 'llm', 'metrics_ingestion', ?, ?, ?)
        """, (
            event_id, payload.model_id,
            json.dumps(payload.dict()),
            json.dumps(normalized),
            timestamp
        ))

        conn.execute("""
            INSERT INTO unified_scores (model_id, risk_index, risk_level, component_scores, timestamp)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(model_id) DO UPDATE SET
              risk_index=excluded.risk_index,
              risk_level=excluded.risk_level,
              component_scores=excluded.component_scores,
              timestamp=excluded.timestamp
        """, (
            payload.model_id,
            risk_scores["unified_risk_index"],
            risk_scores["risk_level"],
            json.dumps(risk_scores["components"]),
            timestamp
        ))
        
        conn.execute("""
            INSERT INTO score_history (model_id, risk_index, risk_level, timestamp)
            VALUES (?, ?, ?, ?)
        """, (payload.model_id, risk_scores["unified_risk_index"], risk_scores["risk_level"], timestamp))
        
        conn.commit()

    background_tasks.add_task(
        run_governance_pipeline,
        payload.model_id, risk_scores, event_id, timestamp
    )

    audit_logger.log(
        event_id=event_id, model_id=payload.model_id,
        action="llm_metrics_ingested", details=risk_scores, timestamp=timestamp
    )

    return {
        "status": "accepted",
        "event_id": event_id,
        "model_id": payload.model_id,
        "unified_risk_index": risk_scores["unified_risk_index"],
        "risk_level": risk_scores["risk_level"],
        "timestamp": timestamp
    }


# ─────────────────────────────────────────────
# QUERY ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/risk-score/{model_id}", response_model=RiskScoreResponse)
async def get_risk_score(model_id: str):
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM unified_scores WHERE model_id = ?", (model_id,)
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")

    with get_db_connection() as conn:
        history = conn.execute("""
            SELECT risk_index, timestamp FROM score_history
            WHERE model_id = ? ORDER BY timestamp DESC LIMIT 30
        """, (model_id,)).fetchall()

    forecast = forecaster.predict_next(
        [h["risk_index"] for h in history]
    ) if history else None

    return {
        "model_id": model_id,
        "risk_index": row["risk_index"],
        "risk_level": row["risk_level"],
        "component_scores": json.loads(row["component_scores"]),
        "timestamp": row["timestamp"],
        "forecast_next": forecast
    }


@app.get("/dashboard/summary")
async def get_dashboard_summary():
    with get_db_connection() as conn:
        scores = conn.execute(
            "SELECT * FROM unified_scores ORDER BY risk_index DESC"
        ).fetchall()

        recent_events = conn.execute("""
            SELECT re.*, us.risk_level FROM risk_events re
            LEFT JOIN unified_scores us ON re.model_id = us.model_id
            ORDER BY re.timestamp DESC LIMIT 20
        """).fetchall()

        governance = conn.execute(
            "SELECT * FROM governance_actions ORDER BY timestamp DESC LIMIT 15"
        ).fetchall()

        history = conn.execute("""
            SELECT model_id, risk_index, timestamp FROM score_history
            ORDER BY timestamp DESC LIMIT 300
        """).fetchall()

    models_list = [dict(s) for s in scores]
    for m in models_list:
        m["component_scores"] = json.loads(m["component_scores"])

    distribution = {"low": 0, "moderate": 0, "high": 0, "critical": 0}
    for m in models_list:
        level = m["risk_level"].lower()
        if level in distribution:
            distribution[level] += 1

    avg_risk = (
        sum(m["risk_index"] for m in models_list) / len(models_list)
        if models_list else 0
    )

    return {
        "total_models": len(models_list),
        "average_risk_index": round(avg_risk, 1),
        "risk_distribution": distribution,
        "models": models_list,
        "recent_events": [dict(e) for e in recent_events],
        "governance_actions": [dict(g) for g in governance],
        "risk_history": [dict(h) for h in history],
        "compliance_score": max(0, 100 - avg_risk),
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/audit-logs")
async def get_audit_logs(limit: int = 50, model_id: str = None):
    query = "SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?"
    params = [limit]

    if model_id:
        query = "SELECT * FROM audit_log WHERE model_id = ? ORDER BY timestamp DESC LIMIT ?"
        params = [model_id, limit]

    with get_db_connection() as conn:
        rows = conn.execute(query, params).fetchall()

    return {
        "audit_logs": [dict(r) for r in rows],
        "count": len(rows)
    }


@app.get("/forecast/{model_id}")
async def get_forecast(model_id: str, window: int = 7):
    with get_db_connection() as conn:
        history = conn.execute("""
            SELECT risk_index, timestamp FROM score_history
            WHERE model_id = ? ORDER BY timestamp ASC
        """, (model_id,)).fetchall()

    if len(history) < 3:
        raise HTTPException(status_code=400, detail="Insufficient history for forecasting")

    scores = [h["risk_index"] for h in history]
    timestamps = [h["timestamp"] for h in history]

    forecast_result = forecaster.full_forecast(scores, timestamps, window)
    return {"model_id": model_id, **forecast_result}


@app.get("/governance/actions")
async def get_governance_actions(model_id: str = None):
    with get_db_connection() as conn:
        if model_id:
            rows = conn.execute(
                "SELECT * FROM governance_actions WHERE model_id = ? ORDER BY timestamp DESC",
                (model_id,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM governance_actions ORDER BY timestamp DESC LIMIT 50"
            ).fetchall()

    return {"governance_actions": [dict(r) for r in rows]}


@app.get("/health")
async def health_check():
    with get_db_connection() as conn:
        model_count = conn.execute("SELECT COUNT(*) as c FROM unified_scores").fetchone()["c"]
    
    return {
        "status": "healthy",
        "service": "AegisAI Demo",
        "version": "2.0-demo",
        "active_models": model_count,
        "data_evolution": "active"
    }


# ─────────────────────────────────────────────
# INTERNAL PIPELINE
# ─────────────────────────────────────────────

async def run_governance_pipeline(model_id: str, risk_scores: dict, event_id: str, timestamp: str):
    risk_index = risk_scores["unified_risk_index"]
    actions = policy_engine.evaluate(model_id, risk_index, risk_scores["components"])

    with get_db_connection() as conn:
        for action in actions:
            action_id = str(uuid.uuid4())
            conn.execute("""
                INSERT INTO governance_actions
                  (id, model_id, action_type, reason, triggered_by_risk, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                action_id, model_id,
                action["action"], action["reason"],
                risk_index, timestamp
            ))

            audit_logger.log(
                event_id=action_id, model_id=model_id,
                action=f"governance_{action['action']}",
                details=action, timestamp=timestamp
            )

        conn.commit()