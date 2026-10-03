"""
seed_demo_data.py

This script injects realistic, named example experiments into the SQLite database
to serve as a demo for "Molecular Story Mode" and the Contradiction Detector.

WARNING: This script is for demo/presentation setup only.
It should be run manually against a fresh or demo database.
Never run this against a real user's production database.
"""

import sys
import os
import json
import uuid
from datetime import datetime, timezone

# Add the parent directory to the path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.database import SessionLocal, init_db
from app.db.models import Experiment, SavedDocument, User

def run_seed():
    db = SessionLocal()
    
    # Ensure there's a user to own these demo objects
    user = db.query(User).first()
    if not user:
        print("No user found. Please register a user in the UI first.")
        db.close()
        return

    user_id = user.id
    
    print(f"Seeding demo data for User ID: {user_id}")

    # =========================================================================
    # EXPERIMENT CHAIN
    # =========================================================================
    
    # Experiment 1: Biphenyl (High Lipophilicity, Low Polarity + Efficacy vs Cardiotoxicity)
    exp1 = Experiment(
        user_id=user_id,
        local_id=str(uuid.uuid4()),
        name="[DEMO] Base Scaffold Analysis",
        original_smiles="c1ccccc1-c2ccccc2",
        modified_smiles="c1ccccc1-c2ccccc2",
        molfile="c1ccccc1-c2ccccc2",
        properties_json=json.dumps({
            "formula": "C12H10",
            "mw": 154.21,
            "logp": 3.98,
            "tpsa": 0.0,
            "hbd": 0,
            "hba": 0,
            "rotatable_bonds": 1,
            "lipinski_violations": 0
        }),
        predictions_json=json.dumps([
            {"endpoint_name": "hERG", "status_label": "High Risk", "confidence": 0.82},
            {"endpoint_name": "anti-inflammatory", "status_label": "Likely Active", "confidence": 0.76}
        ]),
        ai_insight="The base biphenyl scaffold shows strong anti-inflammatory potential but carries a significant hERG cardiotoxicity risk due to its highly lipophilic nature.",
        date=datetime.now(timezone.utc).isoformat(),
        parent_experiment_id=None
    )
    db.add(exp1)
    db.commit()
    db.refresh(exp1)
    
    # Experiment 2: 4-phenylphenol (Hydroxyl addition)
    exp2 = Experiment(
        user_id=user_id,
        local_id=str(uuid.uuid4()),
        name="[DEMO] Hydroxyl Modification",
        original_smiles="c1ccccc1-c2ccccc2",
        modified_smiles="Oc1ccc(-c2ccccc2)cc1",
        molfile="Oc1ccc(-c2ccccc2)cc1",
        properties_json=json.dumps({
            "formula": "C12H10O",
            "mw": 170.21,
            "logp": 3.20,
            "tpsa": 20.2,
            "hbd": 1,
            "hba": 1,
            "rotatable_bonds": 1,
            "lipinski_violations": 0
        }),
        predictions_json=json.dumps([
            {"endpoint_name": "hERG", "status_label": "Moderate Risk", "confidence": 0.65},
            {"endpoint_name": "anti-inflammatory", "status_label": "Active", "confidence": 0.81}
        ]),
        ai_insight="Adding a hydroxyl group improved polarity and slightly reduced hERG risk, but logP is still somewhat high. Solubility might still be an issue.",
        date=datetime.now(timezone.utc).isoformat(),
        parent_experiment_id=exp1.id
    )
    db.add(exp2)
    db.commit()
    db.refresh(exp2)

    # Experiment 3: Biphenyl-4-carboxylic acid (Carboxyl addition)
    exp3 = Experiment(
        user_id=user_id,
        local_id=str(uuid.uuid4()),
        name="[DEMO] Final Carboxyl Optimization",
        original_smiles="Oc1ccc(-c2ccccc2)cc1",
        modified_smiles="O=C(O)c1ccc(-c2ccccc2)cc1",
        molfile="O=C(O)c1ccc(-c2ccccc2)cc1",
        properties_json=json.dumps({
            "formula": "C13H10O2",
            "mw": 198.22,
            "logp": 2.85,
            "tpsa": 37.3,
            "hbd": 1,
            "hba": 2,
            "rotatable_bonds": 2,
            "lipinski_violations": 0
        }),
        predictions_json=json.dumps([
            {"endpoint_name": "hERG", "status_label": "Low Risk", "confidence": 0.88},
            {"endpoint_name": "anti-inflammatory", "status_label": "Highly Active", "confidence": 0.92}
        ]),
        ai_insight="The addition of a carboxylic acid dramatically lowered logP into an optimal range and mitigated hERG risk entirely, creating a strong lead candidate.",
        date=datetime.now(timezone.utc).isoformat(),
        parent_experiment_id=exp2.id
    )
    db.add(exp3)
    db.commit()

    # =========================================================================
    # SAVED DOCUMENTS
    # =========================================================================
    
    doc1 = SavedDocument(
        user_id=user_id,
        name="[DEMO] Optimization Summary - Biphenyl Scaffold",
        format="report",
        html_content="<h1>Demo Report</h1><p>This is a seeded demo document.</p>",
        smiles="O=C(O)c1ccc(-c2ccccc2)cc1"
    )
    db.add(doc1)
    db.commit()

    print("Successfully seeded 3 demo experiments and 1 demo document.")
    db.close()

if __name__ == "__main__":
    run_seed()
