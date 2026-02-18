"""
AegisAI Policy & Governance Engine
────────────────────────────────────
Evaluates configurable JSON policy rules against risk scores.
Triggers automated governance actions.
"""

import json
from typing import Dict, List
from pathlib import Path


# ─────────────────────────────────────────────
# DEFAULT POLICY RULESET
# ─────────────────────────────────────────────

DEFAULT_POLICIES = {
    "global_risk": {
        "unified_risk_index": {
            "thresholds": [
                {
                    "condition": ">=",
                    "value": 81,
                    "action": "freeze_model",
                    "severity": "critical",
                    "reason": "Unified Risk Index exceeds critical threshold (81+). Model frozen pending review.",
                    "notify": ["cro", "cto", "compliance_team"],
                    "sla_hours": 4
                },
                {
                    "condition": ">=",
                    "value": 61,
                    "action": "escalate_to_human",
                    "severity": "high",
                    "reason": "Unified Risk Index in high-risk zone (61-80). Escalation required.",
                    "notify": ["model_risk_team", "compliance_team"],
                    "sla_hours": 24
                },
                {
                    "condition": ">=",
                    "value": 31,
                    "action": "send_alert",
                    "severity": "moderate",
                    "reason": "Unified Risk Index in moderate zone (31-60). Monitoring increased.",
                    "notify": ["model_risk_team"],
                    "sla_hours": 72
                }
            ]
        }
    },
    "component_policies": {
        "hallucination_score": {
            "thresholds": [
                {
                    "condition": ">=",
                    "value": 0.7,
                    "action": "freeze_model",
                    "severity": "critical",
                    "reason": "Hallucination rate critically high. Model output unreliable for banking operations."
                },
                {
                    "condition": ">=",
                    "value": 0.4,
                    "action": "add_disclaimer_layer",
                    "severity": "high",
                    "reason": "Elevated hallucination rate. Output disclaimer and human review enforced."
                }
            ]
        },
        "prompt_injection_risk": {
            "thresholds": [
                {
                    "condition": ">=",
                    "value": 0.6,
                    "action": "enable_strict_filtering",
                    "severity": "critical",
                    "reason": "High prompt injection activity detected. Strict input filtering activated."
                }
            ]
        },
        "data_leakage_risk": {
            "thresholds": [
                {
                    "condition": ">=",
                    "value": 0.3,
                    "action": "freeze_model",
                    "severity": "critical",
                    "reason": "Potential PII/financial data leakage. Immediate model freeze per SR 11-7."
                }
            ]
        },
        "drift_score": {
            "thresholds": [
                {
                    "condition": ">=",
                    "value": 0.7,
                    "action": "trigger_retraining",
                    "severity": "high",
                    "reason": "Significant model drift detected. Retraining pipeline triggered."
                },
                {
                    "condition": ">=",
                    "value": 0.4,
                    "action": "flag_for_review",
                    "severity": "moderate",
                    "reason": "Moderate drift observed. Model flagged for next quarterly review."
                }
            ]
        },
        "bias_score": {
            "thresholds": [
                {
                    "condition": ">=",
                    "value": 0.6,
                    "action": "freeze_model",
                    "severity": "critical",
                    "reason": "Model bias exceeds regulatory tolerance. Frozen pending fairness audit (ECOA compliance)."
                }
            ]
        }
    },
    "regulatory_mapping": {
        "SR_11_7": {
            "description": "Federal Reserve guidance on model risk management",
            "triggers": ["drift_score", "bias_score"],
            "required_action": "document_and_review"
        },
        "ECOA": {
            "description": "Equal Credit Opportunity Act — fairness requirements",
            "triggers": ["bias_score"],
            "required_action": "fairness_audit"
        },
        "EU_AI_ACT": {
            "description": "EU AI Act high-risk system requirements",
            "triggers": ["hallucination_score", "data_leakage_risk", "prompt_injection_risk"],
            "required_action": "conformity_assessment"
        }
    }
}


class PolicyEngine:
    def __init__(self, policy_config: dict = None):
        self.policies = policy_config or DEFAULT_POLICIES

    def evaluate(self, model_id: str, risk_index: float, components: dict) -> List[dict]:
        """
        Evaluate all applicable policy rules.
        Returns list of governance actions to take.
        """
        actions = []
        seen_actions = set()  # Deduplicate: take the highest severity action

        # 1. Evaluate global unified risk index
        global_rules = self.policies.get("global_risk", {}).get("unified_risk_index", {})
        for threshold_rule in global_rules.get("thresholds", []):
            if self._check_condition(risk_index, threshold_rule["condition"], threshold_rule["value"]):
                action_key = threshold_rule["action"]
                if action_key not in seen_actions:
                    seen_actions.add(action_key)
                    actions.append({
                        "model_id": model_id,
                        "action": threshold_rule["action"],
                        "severity": threshold_rule["severity"],
                        "reason": threshold_rule["reason"],
                        "triggered_by": "unified_risk_index",
                        "triggered_value": risk_index,
                        "notify": threshold_rule.get("notify", []),
                        "sla_hours": threshold_rule.get("sla_hours"),
                        "regulatory_refs": self._get_regulatory_refs("unified_risk_index")
                    })
                break  # Only fire highest applicable global rule

        # 2. Evaluate component-level policies
        component_policies = self.policies.get("component_policies", {})
        for component_name, component_score in components.items():
            if component_name not in component_policies:
                continue
            rules = component_policies[component_name].get("thresholds", [])
            for rule in rules:
                if self._check_condition(component_score, rule["condition"], rule["value"]):
                    action_key = f"{component_name}_{rule['action']}"
                    if action_key not in seen_actions:
                        seen_actions.add(action_key)
                        actions.append({
                            "model_id": model_id,
                            "action": rule["action"],
                            "severity": rule["severity"],
                            "reason": rule["reason"],
                            "triggered_by": component_name,
                            "triggered_value": component_score,
                            "regulatory_refs": self._get_regulatory_refs(component_name)
                        })
                    break  # Highest applicable per component

        return actions

    def _check_condition(self, value: float, condition: str, threshold: float) -> bool:
        ops = {
            ">=": value >= threshold,
            ">":  value > threshold,
            "<=": value <= threshold,
            "<":  value < threshold,
            "==": abs(value - threshold) < 0.001,
        }
        return ops.get(condition, False)

    def _get_regulatory_refs(self, trigger: str) -> List[str]:
        refs = []
        for reg, config in self.policies.get("regulatory_mapping", {}).items():
            if trigger in config.get("triggers", []):
                refs.append(reg)
        return refs

    def get_policy_summary(self) -> dict:
        return {
            "policy_version": "1.0.0",
            "total_rules": sum(
                len(v.get("thresholds", []))
                for v in self.policies.get("component_policies", {}).values()
            ),
            "regulatory_frameworks": list(self.policies.get("regulatory_mapping", {}).keys()),
            "policies": self.policies
        }
