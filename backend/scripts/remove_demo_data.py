import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.db.database import SessionLocal
from app.db.models import Experiment, SavedDocument
def run():
    db = SessionLocal()
    exps = db.query(Experiment).filter(Experiment.name.like("[DEMO]%")).all()
    for e in exps: db.delete(e)
    docs = db.query(SavedDocument).filter(SavedDocument.name.like("[DEMO]%")).all()
    for d in docs: db.delete(d)
    db.commit()
    db.close()
    print("Demo data removed.")
if __name__ == "__main__": run()
