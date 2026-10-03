import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.database import SessionLocal
from app.db.models import Experiment

def run_fix():
    db = SessionLocal()
    exps = db.query(Experiment).filter(Experiment.name.like("[DEMO]%")).all()
    for exp in exps:
        if not exp.molfile:
            exp.molfile = exp.original_smiles
            print(f"Fixed molfile for {exp.name}")
    db.commit()
    db.close()

if __name__ == "__main__":
    run_fix()
