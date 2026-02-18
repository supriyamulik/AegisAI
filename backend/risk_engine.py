"""
AegisAI Risk Engine
──────────────────
Risk Normalization → Component Scoring → Unified AI Risk Index
Supports both Traditional ML and LLM risk dimensions.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
import math
import statistics


# ─────────────────────────────────────────────
# WEIGHT CONFIGURATION
# ─────────────────────────────────────────────

DEFAULT_ML_WEIGHTS = {
    "drift_score": 0.30,
    "bias_score": 0.30,
    "prediction_instability": 0.20,
    "data_quality_score": 0.20,
}

DEFAULT_LLM_WEIGHTS = {
    "hallucination_score": 0.30,
    "toxicity_score": 0.20,
    "prompt_injection_risk": 0.25,
    "data_leakage_risk": 0.25,
}

# Thresholds for the Unified Risk Index
RISK_THRESHOLDS = {
    "low":      (0,  30),
    "moderate": (31, 60),
    "high":     (61, 80),
    "critical": (81, 100),
}


def classify_risk_level(score: float) -> str:
    for level, (lo, hi) in RISK_THRESHOLDS.items():
        if lo <= score <= hi:
            return level
    return "critical"


# ─────────────────────────────────────────────
# NORMALIZATION ENGINE
# ─────────────────────────────────────────────

class RiskNormalizationEngine:
    """
    Transforms raw telemetry signals into normalized 0–1 risk scores.
    Each metric has a domain-specific normalization function.
    """

    def normalize_ml_metrics(self, raw: dict) -> dict:
        """
        Normalize traditional ML telemetry.

        Input (raw):
          drift_magnitude: float (raw PSI or KS score, typically 0–2+)
          bias_disparity:  float (demographic parity gap 0–1)
          pred_std_dev:    float (std dev of prediction probabilities)
          missing_rate:    float (fraction of missing features 0–1)

        Returns: all values in 0–1 range
        """
        normalized = {}

        # Drift: PSI-based normalization
        # PSI < 0.1 = no drift, 0.1–0.2 = moderate, > 0.2 = severe
        drift_raw = raw.get("drift_magnitude", 0.0)
        normalized["drift_score"] = self._sigmoid_normalize(drift_raw, center=0.15, steepness=10)

        # Bias: direct demographic parity gap (already 0–1)
        bias_raw = raw.get("bias_disparity", 0.0)
        normalized["bias_score"] = min(1.0, max(0.0, bias_raw * 1.5))  # amplify sensitivity

        # Prediction instability: normalize std dev of outputs
        pred_std = raw.get("pred_std_dev", 0.0)
        normalized["prediction_instability"] = self._sigmoid_normalize(pred_std, center=0.15, steepness=12)

        # Data quality: invert missing rate
        missing_rate = raw.get("missing_rate", 0.0)
        normalized["data_quality_score"] = min(1.0, missing_rate * 2.5)

        return normalized

    def normalize_llm_metrics(self, raw: dict) -> dict:
        """
        Normalize LLM-specific telemetry.

        Input (raw):
          hallucination_rate:       float (0–1, fraction of hallucinated responses)
          toxicity_rate:            float (0–1, fraction flagged toxic)
          prompt_injection_attempts: int  (count per time window)
          total_requests:           int  (denominator)
          sensitive_data_flags:     int  (PII/financial data leakage events)

        Returns: all values in 0–1 range
        """
        normalized = {}
        total = max(1, raw.get("total_requests", 100))

        # Hallucination: direct rate, amplified for banking sensitivity
        hall_rate = raw.get("hallucination_rate", 0.0)
        normalized["hallucination_score"] = min(1.0, hall_rate * 1.8)

        # Toxicity: direct rate
        tox_rate = raw.get("toxicity_rate", 0.0)
        normalized["toxicity_score"] = min(1.0, tox_rate * 2.0)

        # Prompt injection: normalize by request volume
        injection_count = raw.get("prompt_injection_attempts", 0)
        injection_rate = injection_count / total
        normalized["prompt_injection_risk"] = self._sigmoid_normalize(injection_rate, center=0.02, steepness=50)

        # Data leakage: normalize flag count
        leak_flags = raw.get("sensitive_data_flags", 0)
        leak_rate = leak_flags / total
        normalized["data_leakage_risk"] = self._sigmoid_normalize(leak_rate, center=0.01, steepness=80)

        return normalized

    @staticmethod
    def _sigmoid_normalize(x: float, center: float = 0.5, steepness: float = 10) -> float:
        """Smooth S-curve normalization — avoids harsh cliffs at threshold boundaries."""
        return 1.0 / (1.0 + math.exp(-steepness * (x - center)))


# ─────────────────────────────────────────────
# AGGREGATION ENGINE
# ─────────────────────────────────────────────

class RiskAggregationEngine:
    """
    Computes the Unified AI Risk Index from normalized component scores.

    Formula:
      UARI = 100 × Σ(wᵢ × scoreᵢ)

    Where:
      - scoreᵢ ∈ [0, 1] (normalized component score)
      - wᵢ are configurable weights summing to 1.0
      - UARI ∈ [0, 100]

    Risk Level:
      0–30   → Low
      31–60  → Moderate
      61–80  → High
      81–100 → Critical
    """

    def __init__(
        self,
        ml_weights: Dict[str, float] = None,
        llm_weights: Dict[str, float] = None
    ):
        self.ml_weights = ml_weights or DEFAULT_ML_WEIGHTS
        self.llm_weights = llm_weights or DEFAULT_LLM_WEIGHTS

        # Validate weights
        assert abs(sum(self.ml_weights.values()) - 1.0) < 0.001, "ML weights must sum to 1.0"
        assert abs(sum(self.llm_weights.values()) - 1.0) < 0.001, "LLM weights must sum to 1.0"

    def compute_ml_risk(self, normalized: dict) -> dict:
        return self._compute_risk(normalized, self.ml_weights)

    def compute_llm_risk(self, normalized: dict) -> dict:
        return self._compute_risk(normalized, self.llm_weights)

    def _compute_risk(self, scores: dict, weights: dict) -> dict:
        """Core weighted aggregation."""
        weighted_sum = sum(
            weights.get(key, 0.0) * scores.get(key, 0.0)
            for key in weights
        )

        # Convert 0–1 weighted sum to 0–100 index
        raw_index = weighted_sum * 100

        # Apply non-linear amplification for high-risk states
        # This ensures critical risks are never understated
        amplified_index = self._apply_risk_amplification(raw_index)

        risk_index = round(min(100.0, max(0.0, amplified_index)), 1)
        risk_level = classify_risk_level(risk_index)

        return {
            "unified_risk_index": risk_index,
            "risk_level": risk_level,
            "components": scores,
            "weights_applied": weights,
        }

    @staticmethod
    def _apply_risk_amplification(score: float) -> float:
        """
        Non-linear amplification: scores in the high/critical range
        are pushed higher to avoid underestimating tail risks.
        This models the asymmetric cost of ignoring critical failures.
        """
        if score <= 60:
            return score
        # Quadratic amplification above 60
        excess = score - 60
        amplified = 60 + excess * (1 + excess / 100)
        return min(100, amplified)


# ─────────────────────────────────────────────
# FORECASTING ENGINE
# ─────────────────────────────────────────────

class RiskForecaster:
    """
    Basic predictive risk forecasting using moving averages
    and simple anomaly detection.
    """

    def predict_next(self, history: List[float], window: int = 5) -> Optional[float]:
        """Simple moving average prediction for next time step."""
        if len(history) < 2:
            return None
        window = min(window, len(history))
        return round(sum(history[-window:]) / window, 1)

    def full_forecast(
        self,
        scores: List[float],
        timestamps: List[str],
        window: int = 7
    ) -> dict:
        """
        Full forecast including:
        - Moving average series
        - Trend direction
        - Anomaly detection (z-score based)
        - Spike prediction
        """
        if len(scores) < 3:
            return {"error": "Insufficient data"}

        # Moving average
        ma_series = []
        for i in range(len(scores)):
            start = max(0, i - window + 1)
            window_slice = scores[start:i + 1]
            ma_series.append(round(sum(window_slice) / len(window_slice), 1))

        # Trend direction (last 5 points)
        recent = scores[-5:]
        if len(recent) >= 2:
            slope = (recent[-1] - recent[0]) / max(1, len(recent) - 1)
            trend = "increasing" if slope > 1.0 else "decreasing" if slope < -1.0 else "stable"
        else:
            trend = "stable"

        # Anomaly detection: z-score > 2 = anomaly
        mean = statistics.mean(scores)
        std = statistics.stdev(scores) if len(scores) > 1 else 1.0
        anomalies = []
        for i, (score, ts) in enumerate(zip(scores, timestamps)):
            z = abs((score - mean) / max(std, 0.001))
            if z > 2.0:
                anomalies.append({
                    "index": i,
                    "timestamp": ts,
                    "score": score,
                    "z_score": round(z, 2)
                })

        # Forecast next 3 steps
        forecast_points = []
        last = list(scores)  # copy
        for step in range(1, 4):
            next_val = self.predict_next(last, window)
            if next_val is not None:
                # Add small trend adjustment
                if trend == "increasing":
                    next_val = min(100, next_val + slope * 0.5)
                elif trend == "decreasing":
                    next_val = max(0, next_val + slope * 0.5)
                forecast_points.append(round(next_val, 1))
                last.append(next_val)

        # Spike risk: probability risk will exceed 80 within next 3 steps
        spike_risk = "none"
        if forecast_points:
            max_forecast = max(forecast_points)
            if max_forecast >= 80:
                spike_risk = "high"
            elif max_forecast >= 60:
                spike_risk = "moderate"
            elif max_forecast >= 40:
                spike_risk = "low"

        return {
            "historical_scores": scores,
            "timestamps": timestamps,
            "moving_average": ma_series,
            "trend": trend,
            "anomalies": anomalies,
            "forecast_next_3": forecast_points,
            "spike_risk": spike_risk,
            "mean": round(mean, 1),
            "std_dev": round(std, 1),
        }
