"""
AegisAI Pydantic Models — Request/Response Schemas
"""

from pydantic import BaseModel, Field, validator
from typing import Dict, List, Optional, Any
from datetime import datetime


# ─────────────────────────────────────────────
# INGESTION PAYLOADS
# ─────────────────────────────────────────────

class MLMetricsPayload(BaseModel):
    """Traditional ML model telemetry."""
    model_id: str = Field(..., example="credit-scoring-v3")
    model_name: Optional[str] = Field(None, example="Credit Scoring Model v3")

    # Drift
    drift_magnitude: float = Field(
        default=0.0, ge=0, le=5.0,
        description="PSI or KS statistic measuring feature/prediction drift"
    )

    # Bias
    bias_disparity: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Demographic parity gap (e.g., approval rate difference across groups)"
    )

    # Stability
    pred_std_dev: float = Field(
        default=0.0, ge=0.0,
        description="Standard deviation of prediction probabilities (higher = more unstable)"
    )

    # Data quality
    missing_rate: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Fraction of features with missing values in this evaluation window"
    )

    # Context
    evaluation_window_hours: int = Field(default=24)
    sample_size: int = Field(default=1000)
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        schema_extra = {
            "example": {
                "model_id": "credit-scoring-v3",
                "model_name": "Credit Scoring Model v3",
                "drift_magnitude": 0.18,
                "bias_disparity": 0.12,
                "pred_std_dev": 0.09,
                "missing_rate": 0.03,
                "evaluation_window_hours": 24,
                "sample_size": 5000
            }
        }


class LLMMetricsPayload(BaseModel):
    """LLM system telemetry."""
    model_id: str = Field(..., example="loan-advisor-llm-v2")
    model_name: Optional[str] = Field(None)

    # Factual accuracy
    hallucination_rate: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Fraction of responses containing factual errors"
    )

    # Safety
    toxicity_rate: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Fraction of responses flagged for harmful content"
    )

    # Security
    prompt_injection_attempts: int = Field(
        default=0, ge=0,
        description="Count of detected prompt injection attempts"
    )
    sensitive_data_flags: int = Field(
        default=0, ge=0,
        description="Count of responses containing PII or financial data"
    )
    total_requests: int = Field(
        default=100, ge=1,
        description="Total requests in the evaluation window"
    )

    # Context
    evaluation_window_hours: int = Field(default=24)
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        schema_extra = {
            "example": {
                "model_id": "loan-advisor-llm-v2",
                "model_name": "Loan Advisor LLM v2",
                "hallucination_rate": 0.08,
                "toxicity_rate": 0.02,
                "prompt_injection_attempts": 14,
                "sensitive_data_flags": 3,
                "total_requests": 2400,
                "evaluation_window_hours": 24
            }
        }


# ─────────────────────────────────────────────
# RESPONSE SCHEMAS
# ─────────────────────────────────────────────

class RiskScoreResponse(BaseModel):
    model_id: str
    risk_index: float
    risk_level: str
    component_scores: Dict[str, float]
    timestamp: str
    forecast_next: Optional[float] = None


class DashboardSummary(BaseModel):
    total_models: int
    average_risk_index: float
    risk_distribution: Dict[str, int]
    models: List[Dict]
    recent_events: List[Dict]
    governance_actions: List[Dict]
    risk_history: List[Dict]
    compliance_score: float
    timestamp: str


class AuditLogEntry(BaseModel):
    id: int
    event_id: str
    model_id: Optional[str]
    action: str
    actor: str
    details: Optional[str]
    checksum: Optional[str]
    timestamp: str


class GovernanceAction(BaseModel):
    id: str
    model_id: str
    action_type: str
    reason: Optional[str]
    triggered_by_risk: Optional[float]
    status: str
    timestamp: str
