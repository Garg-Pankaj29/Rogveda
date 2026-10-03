"""
ROGVEDA — Story Service Tests (Phase 10)

Tests the deterministic delta-computation logic of build_story().
Does NOT test LLM narration (non-deterministic).
Uses an in-memory SQLite database with fake experiment rows.
"""

import json
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.db.models import Experiment
from app.services.story_service import (
    build_story,
    _compute_property_deltas,
    _compute_prediction_deltas,
    _fallback_narration,
)


# ── Fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture
def db_session():
    """Create an in-memory SQLite DB with the Experiment table."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def _make_experiment(
    db,
    *,
    exp_id: int,
    user_id: int = 1,
    name: str = "Test",
    smiles: str = "C",
    properties: dict | None = None,
    predictions: list | None = None,
    parent_id: int | None = None,
):
    """Helper to insert a fake experiment row."""
    exp = Experiment(
        id=exp_id,
        user_id=user_id,
        local_id=f"local-{exp_id}",
        name=name,
        original_smiles=smiles,
        properties_json=json.dumps(properties) if properties else None,
        predictions_json=json.dumps(predictions) if predictions else None,
        parent_experiment_id=parent_id,
        date="2026-09-16T00:00:00Z",
    )
    db.add(exp)
    db.commit()
    return exp


# ── Unit Tests: Property Deltas ───────────────────────────────────────────

class TestPropertyDeltas:
    def test_basic_delta(self):
        prev = {"logP": 1.5, "mw": 180.0, "tpsa": 60.0}
        curr = {"logP": 2.0, "mw": 200.0, "tpsa": 55.0}
        deltas = _compute_property_deltas(prev, curr)

        logp_delta = next(d for d in deltas if d["key"] == "logP")
        assert logp_delta["delta"] == 0.5
        assert logp_delta["direction"] == "increased"
        assert logp_delta["prev"] == 1.5
        assert logp_delta["curr"] == 2.0

        mw_delta = next(d for d in deltas if d["key"] == "mw")
        assert mw_delta["delta"] == 20.0
        assert mw_delta["direction"] == "increased"

        tpsa_delta = next(d for d in deltas if d["key"] == "tpsa")
        assert tpsa_delta["delta"] == -5.0
        assert tpsa_delta["direction"] == "decreased"

    def test_no_change(self):
        props = {"logP": 2.0, "mw": 300.0}
        deltas = _compute_property_deltas(props, props)
        assert deltas == []

    def test_missing_keys(self):
        prev = {"logP": 1.0}
        curr = {"mw": 200.0}
        deltas = _compute_property_deltas(prev, curr)
        # No overlapping numeric keys → no deltas
        assert deltas == []

    def test_string_values_parsed(self):
        prev = {"logP": "1.5"}
        curr = {"logP": "2.0"}
        deltas = _compute_property_deltas(prev, curr)
        assert len(deltas) == 1
        assert deltas[0]["delta"] == 0.5

    def test_none_values_skipped(self):
        prev = {"logP": None}
        curr = {"logP": 2.0}
        deltas = _compute_property_deltas(prev, curr)
        assert deltas == []


# ── Unit Tests: Prediction Deltas ─────────────────────────────────────────

class TestPredictionDeltas:
    def test_label_change(self):
        prev = [{"endpoint_name": "hERG Cardiotoxicity", "status_label": "High Risk", "confidence": 0.8, "available": True}]
        curr = [{"endpoint_name": "hERG Cardiotoxicity", "status_label": "Low Risk", "confidence": 0.75, "available": True}]
        deltas = _compute_prediction_deltas(prev, curr)
        assert len(deltas) == 1
        assert deltas[0]["label_changed"] is True
        assert deltas[0]["prev_label"] == "High Risk"
        assert deltas[0]["curr_label"] == "Low Risk"

    def test_confidence_only_change(self):
        prev = [{"endpoint_name": "Anti-inflammatory", "status_label": "Active", "confidence": 0.7, "available": True}]
        curr = [{"endpoint_name": "Anti-inflammatory", "status_label": "Active", "confidence": 0.9, "available": True}]
        deltas = _compute_prediction_deltas(prev, curr)
        assert len(deltas) == 1
        assert deltas[0]["label_changed"] is False
        assert deltas[0]["confidence_delta"] == 0.2

    def test_no_change(self):
        pred = [{"endpoint_name": "hERG Cardiotoxicity", "status_label": "Low Risk", "confidence": 0.3, "available": True}]
        deltas = _compute_prediction_deltas(pred, pred)
        assert deltas == []

    def test_unavailable_skipped(self):
        prev = [{"endpoint_name": "hERG Cardiotoxicity", "status_label": "High Risk", "confidence": 0.8, "available": True}]
        curr = [{"endpoint_name": "hERG Cardiotoxicity", "status_label": "Low Risk", "confidence": 0.3, "available": False}]
        deltas = _compute_prediction_deltas(prev, curr)
        assert deltas == []


# ── Integration Tests: build_story ────────────────────────────────────────

class TestBuildStory:
    def test_three_step_chain(self, db_session):
        """Test a real 3-step modification chain with numeric deltas."""
        # Step 0: Original (aspirin-like)
        _make_experiment(
            db_session, exp_id=1, name="Original",
            smiles="CC(=O)Oc1ccccc1C(=O)O",
            properties={"mw": 180.16, "logP": 1.31, "tpsa": 63.6, "hbd": 1, "hba": 4},
            predictions=[
                {"endpoint_name": "hERG Cardiotoxicity", "status_label": "Low Risk", "confidence": 0.2, "available": True},
                {"endpoint_name": "Anti-inflammatory", "status_label": "Active", "confidence": 0.85, "available": True},
            ],
        )

        # Step 1: Mod1 (methoxy substitution)
        _make_experiment(
            db_session, exp_id=2, name="Methoxy Mod",
            smiles="CC(=O)Oc1ccc(OC)cc1C(=O)O",
            properties={"mw": 210.18, "logP": 1.79, "tpsa": 72.8, "hbd": 1, "hba": 5},
            predictions=[
                {"endpoint_name": "hERG Cardiotoxicity", "status_label": "Low Risk", "confidence": 0.25, "available": True},
                {"endpoint_name": "Anti-inflammatory", "status_label": "Active", "confidence": 0.78, "available": True},
            ],
            parent_id=1,
        )

        # Step 2: Mod2 (fluorine addition)
        _make_experiment(
            db_session, exp_id=3, name="Fluoro Mod",
            smiles="CC(=O)Oc1cc(F)c(OC)cc1C(=O)O",
            properties={"mw": 228.17, "logP": 2.15, "tpsa": 72.8, "hbd": 1, "hba": 5},
            predictions=[
                {"endpoint_name": "hERG Cardiotoxicity", "status_label": "High Risk", "confidence": 0.65, "available": True},
                {"endpoint_name": "Anti-inflammatory", "status_label": "Active", "confidence": 0.91, "available": True},
            ],
            parent_id=2,
        )

        result = build_story(3, db_session)

        # Chain length
        assert result["chain_length"] == 3
        assert len(result["steps"]) == 3

        # Step 0: no deltas
        assert result["steps"][0]["step_index"] == 0
        assert result["steps"][0]["property_deltas"] == []
        assert result["steps"][0]["prediction_deltas"] == []
        assert result["steps"][0]["smiles"] == "CC(=O)Oc1ccccc1C(=O)O"

        # Step 1 property deltas: mw +30.02, logP +0.48, tpsa +9.2, hba +1
        step1 = result["steps"][1]
        mw_d = next(d for d in step1["property_deltas"] if d["key"] == "mw")
        assert mw_d["delta"] == 30.02
        assert mw_d["direction"] == "increased"

        logp_d = next(d for d in step1["property_deltas"] if d["key"] == "logP")
        assert logp_d["delta"] == 0.48
        assert logp_d["direction"] == "increased"

        tpsa_d = next(d for d in step1["property_deltas"] if d["key"] == "tpsa")
        assert tpsa_d["delta"] == 9.2
        assert tpsa_d["direction"] == "increased"

        hba_d = next(d for d in step1["property_deltas"] if d["key"] == "hba")
        assert hba_d["delta"] == 1.0
        assert hba_d["direction"] == "increased"

        # Step 1 prediction deltas: anti-inflammatory confidence decreased by 0.07
        anti_inf_d = next(d for d in step1["prediction_deltas"] if d["endpoint"] == "Anti-inflammatory")
        assert anti_inf_d["confidence_delta"] == -0.07
        assert anti_inf_d["label_changed"] is False

        # Step 2 property deltas: mw +17.99, logP +0.36
        step2 = result["steps"][2]
        mw_d2 = next(d for d in step2["property_deltas"] if d["key"] == "mw")
        assert mw_d2["delta"] == 17.99
        assert mw_d2["prev"] == 210.18
        assert mw_d2["curr"] == 228.17

        logp_d2 = next(d for d in step2["property_deltas"] if d["key"] == "logP")
        assert logp_d2["delta"] == 0.36

        # Step 2: hERG changed from Low Risk to High Risk
        herg_d2 = next(d for d in step2["prediction_deltas"] if d["endpoint"] == "hERG Cardiotoxicity")
        assert herg_d2["label_changed"] is True
        assert herg_d2["prev_label"] == "Low Risk"
        assert herg_d2["curr_label"] == "High Risk"

        # Step 2: anti-inflammatory confidence increased
        anti_d2 = next(d for d in step2["prediction_deltas"] if d["endpoint"] == "Anti-inflammatory")
        assert anti_d2["confidence_delta"] == 0.13
        assert anti_d2["label_changed"] is False

    def test_single_experiment_no_chain(self, db_session):
        """A single experiment with no parent should return chain_length=1."""
        _make_experiment(db_session, exp_id=10, name="Standalone", smiles="C")
        result = build_story(10, db_session)
        assert result["chain_length"] == 1
        assert len(result["steps"]) == 1
        assert result["steps"][0]["property_deltas"] == []

    def test_two_step_chain(self, db_session):
        """Simple parent → child chain."""
        _make_experiment(
            db_session, exp_id=20, name="Parent",
            smiles="C",
            properties={"logP": 0.5, "mw": 16.04},
        )
        _make_experiment(
            db_session, exp_id=21, name="Child",
            smiles="CC",
            properties={"logP": 1.0, "mw": 30.07},
            parent_id=20,
        )
        result = build_story(21, db_session)
        assert result["chain_length"] == 2
        step1 = result["steps"][1]
        logp_d = next(d for d in step1["property_deltas"] if d["key"] == "logP")
        assert logp_d["delta"] == 0.5

    def test_nonexistent_experiment(self, db_session):
        """build_story on a missing ID returns empty chain."""
        result = build_story(999, db_session)
        assert result["chain_length"] == 0
        assert result["steps"] == []

    def test_missing_properties_json(self, db_session):
        """Experiments with null properties_json should not crash."""
        _make_experiment(db_session, exp_id=30, name="A", smiles="C")
        _make_experiment(db_session, exp_id=31, name="B", smiles="CC", parent_id=30)
        result = build_story(31, db_session)
        assert result["chain_length"] == 2
        assert result["steps"][1]["property_deltas"] == []


# ── Fallback Narration Tests ──────────────────────────────────────────────

class TestFallbackNarration:
    def test_single_step(self):
        steps = [{"step_index": 0, "smiles": "C", "experiment_name": "Root", "property_deltas": [], "prediction_deltas": []}]
        result = _fallback_narration(steps)
        assert "No modification chain" in result

    def test_multi_step(self):
        steps = [
            {"step_index": 0, "smiles": "C", "experiment_name": "Root", "property_deltas": [], "prediction_deltas": []},
            {
                "step_index": 1, "smiles": "CC", "experiment_name": "Mod1",
                "property_deltas": [{"property": "LogP", "key": "logP", "prev": 0.5, "curr": 1.0, "delta": 0.5, "direction": "increased"}],
                "prediction_deltas": [{"endpoint": "hERG", "prev_label": "High Risk", "curr_label": "Low Risk", "label_changed": True, "confidence_delta": -0.3}],
            },
        ]
        result = _fallback_narration(steps)
        assert "2 steps" in result
        assert "LogP increased by 0.5" in result
        assert "hERG" in result
        assert "High Risk → Low Risk" in result
