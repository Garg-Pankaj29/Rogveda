"""
Tests for contradiction_service.detect_contradictions()
"""

import pytest
from app.services.contradiction_service import detect_contradictions


# ─── Helpers ────────────────────────────────────────────────────────

def _make_predictions(
    anti_inf_status="Active",
    anti_inf_conf=0.85,
    herg_status="High Risk",
    herg_conf=0.78,
):
    """Build a predictions list matching the /predict-all format."""
    return [
        {
            "endpoint_name": "Anti-inflammatory",
            "status_label": anti_inf_status,
            "confidence": anti_inf_conf,
            "available": True,
        },
        {
            "endpoint_name": "hERG Cardiotoxicity",
            "status_label": herg_status,
            "confidence": herg_conf,
            "available": True,
        },
        {
            "endpoint_name": "Antioxidant",
            "status_label": "Inactive",
            "confidence": 0.3,
            "available": True,
        },
    ]


# ─── Rule 1: efficacy_vs_cardiotoxicity_tradeoff ───────────────────

class TestEfficacyVsCardiotoxicity:

    def test_triggers_when_anti_inf_active_and_herg_high_risk(self):
        props = {"logp": 2.0, "tpsa": 60.0}
        preds = _make_predictions(
            anti_inf_status="Active",
            anti_inf_conf=0.85,
            herg_status="High Risk",
            herg_conf=0.78,
        )
        flags = detect_contradictions(props, preds)
        names = [f["flag_name"] for f in flags]
        assert "efficacy_vs_cardiotoxicity_tradeoff" in names

    def test_does_not_trigger_when_herg_low_risk(self):
        props = {"logp": 2.0, "tpsa": 60.0}
        preds = _make_predictions(
            anti_inf_status="Active",
            anti_inf_conf=0.85,
            herg_status="Low Risk",
            herg_conf=0.22,
        )
        flags = detect_contradictions(props, preds)
        names = [f["flag_name"] for f in flags]
        assert "efficacy_vs_cardiotoxicity_tradeoff" not in names

    def test_does_not_trigger_when_anti_inf_inactive(self):
        props = {"logp": 2.0, "tpsa": 60.0}
        preds = _make_predictions(
            anti_inf_status="Inactive",
            anti_inf_conf=0.3,
            herg_status="High Risk",
            herg_conf=0.78,
        )
        flags = detect_contradictions(props, preds)
        names = [f["flag_name"] for f in flags]
        assert "efficacy_vs_cardiotoxicity_tradeoff" not in names

    def test_does_not_trigger_when_anti_inf_conf_below_threshold(self):
        props = {"logp": 2.0, "tpsa": 60.0}
        preds = _make_predictions(
            anti_inf_status="Active",
            anti_inf_conf=0.55,  # <= 0.6
            herg_status="High Risk",
            herg_conf=0.78,
        )
        flags = detect_contradictions(props, preds)
        names = [f["flag_name"] for f in flags]
        assert "efficacy_vs_cardiotoxicity_tradeoff" not in names

    def test_explanation_facts_populated(self):
        props = {"logp": 2.0, "tpsa": 60.0}
        preds = _make_predictions()
        flags = detect_contradictions(props, preds)
        tradeoff = [f for f in flags if f["flag_name"] == "efficacy_vs_cardiotoxicity_tradeoff"]
        assert len(tradeoff) == 1
        facts = tradeoff[0]["explanation_facts"]
        assert "anti_inflammatory_status" in facts
        assert "herg_status" in facts
        assert "explanation" in facts


# ─── Rule 2: high_lipophilicity_low_polarity_solubility_risk ────────

class TestLipophilicitySolubility:

    def test_triggers_when_logp_high_tpsa_low(self):
        props = {"logp": 4.5, "tpsa": 25.0}
        preds = []
        flags = detect_contradictions(props, preds)
        names = [f["flag_name"] for f in flags]
        assert "high_lipophilicity_low_polarity_solubility_risk" in names

    def test_does_not_trigger_when_logp_below_3(self):
        props = {"logp": 2.5, "tpsa": 25.0}
        preds = []
        flags = detect_contradictions(props, preds)
        names = [f["flag_name"] for f in flags]
        assert "high_lipophilicity_low_polarity_solubility_risk" not in names

    def test_does_not_trigger_when_tpsa_above_40(self):
        props = {"logp": 4.5, "tpsa": 60.0}
        preds = []
        flags = detect_contradictions(props, preds)
        names = [f["flag_name"] for f in flags]
        assert "high_lipophilicity_low_polarity_solubility_risk" not in names

    def test_boundary_logp_exactly_3(self):
        """logP must be > 3, not >= 3"""
        props = {"logp": 3.0, "tpsa": 25.0}
        preds = []
        flags = detect_contradictions(props, preds)
        names = [f["flag_name"] for f in flags]
        assert "high_lipophilicity_low_polarity_solubility_risk" not in names

    def test_boundary_tpsa_exactly_40(self):
        """TPSA must be < 40, not <= 40"""
        props = {"logp": 4.5, "tpsa": 40.0}
        preds = []
        flags = detect_contradictions(props, preds)
        names = [f["flag_name"] for f in flags]
        assert "high_lipophilicity_low_polarity_solubility_risk" not in names


# ─── Edge cases ─────────────────────────────────────────────────────

class TestEdgeCases:

    def test_empty_properties_and_predictions(self):
        flags = detect_contradictions({}, [])
        assert flags == []

    def test_missing_logp_key(self):
        props = {"tpsa": 25.0}
        flags = detect_contradictions(props, [])
        assert flags == []

    def test_missing_tpsa_key(self):
        props = {"logp": 5.0}
        flags = detect_contradictions(props, [])
        assert flags == []

    def test_both_rules_can_fire_simultaneously(self):
        props = {"logp": 5.0, "tpsa": 20.0}
        preds = _make_predictions(
            anti_inf_status="Active",
            anti_inf_conf=0.9,
            herg_status="High Risk",
            herg_conf=0.85,
        )
        flags = detect_contradictions(props, preds)
        names = [f["flag_name"] for f in flags]
        assert "efficacy_vs_cardiotoxicity_tradeoff" in names
        assert "high_lipophilicity_low_polarity_solubility_risk" in names

    def test_accepts_logP_capital_key(self):
        """Properties from /ai-summary use 'logP' with capital P."""
        props = {"logP": 4.5, "tpsa": 25.0}
        preds = []
        flags = detect_contradictions(props, preds)
        names = [f["flag_name"] for f in flags]
        assert "high_lipophilicity_low_polarity_solubility_risk" in names
