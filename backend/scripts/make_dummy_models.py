import os
import joblib
from pathlib import Path
import json
import numpy as np
from sklearn.ensemble import RandomForestClassifier

models_dir = Path("/home/pankaj-garg/Documents/Projects/Rogveda/models")
models_dir.mkdir(parents=True, exist_ok=True)
endpoints = ["herg", "antiinflammatory", "tox21_mmp", "anticancer", "antioxidant", "antimicrobial"]

for ep in endpoints:
    clf = RandomForestClassifier(n_estimators=1, random_state=42)
    # Train with dummy 2048-dim vectors (Morgan fingerprints)
    X = np.random.rand(2, 2048)
    y = np.array([0, 1])
    clf.fit(X, y)
    joblib.dump(clf, models_dir / f"{ep}_model.pkl")
    with open(models_dir / f"{ep}_model_metadata.json", "w") as f:
        json.dump({"chosen_threshold": 0.5}, f)

print("Proper sklearn dummy models created.")
