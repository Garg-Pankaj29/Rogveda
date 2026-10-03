"""
ROGVEDA — Task 3: Train Calibrated hERG Classifier

Loads the scaffold-split train/test pickles produced by build_dataset.py,
trains a RandomForestClassifier on Morgan fingerprints, wraps it in
CalibratedClassifierCV (sigmoid method) for well-calibrated probabilities,
evaluates on the held-out scaffold-split test set, and saves the final
calibrated model to models/herg_model.pkl.

Per project rules (docs/04_RULES.md §4):
  - Every prediction ships with a *calibrated* confidence score.
  - Models are versioned artifacts with metadata.
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

# ── Paths ───────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
MODELS_DIR = PROJECT_ROOT / "models"


# ── Helpers ─────────────────────────────────────────────────────
def load_xy(pkl_path: Path) -> tuple[np.ndarray, np.ndarray]:
    """Load a pickle DataFrame; return (X_fingerprints, y_labels)."""
    df = pd.read_pickle(pkl_path)
    X = np.stack(df["morgan_fp"].values)  # (n, 2048)
    y = df["active"].values
    return X, y


# ── Main ────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="Train ML Model")
    parser.add_argument("--endpoint", type=str, required=True, help="Name of the endpoint")
    args = parser.parse_args()

    endpoint = args.endpoint
    
    # Backward compatibility for herg paths if needed, but build_dataset now uses train_herg.pkl
    train_pkl = PROCESSED_DIR / f"train_{endpoint}.pkl"
    test_pkl = PROCESSED_DIR / f"test_{endpoint}.pkl"
    model_path = MODELS_DIR / f"{endpoint}_model.pkl"
    metadata_path = MODELS_DIR / f"{endpoint}_model_metadata.json"

    for p in (train_pkl, test_pkl):
        if not p.exists():
            print(f"Error: {p} not found. Run build_dataset.py first.")
            sys.exit(1)

    # ── Load data ───────────────────────────────────────────────
    print("Loading data...")
    X_train, y_train = load_xy(train_pkl)
    X_test, y_test = load_xy(test_pkl)
    print(f"  Train: {X_train.shape[0]} samples  (active={y_train.sum()}, "
          f"inactive={len(y_train) - y_train.sum()})")
    print(f"  Test:  {X_test.shape[0]} samples  (active={y_test.sum()}, "
          f"inactive={len(y_test) - y_test.sum()})")

    # ── Train base RandomForest ─────────────────────────────────
    print("\nTraining RandomForestClassifier...")
    rf = RandomForestClassifier(
        n_estimators=500,
        max_depth=None,
        min_samples_leaf=2,
        class_weight="balanced",      # handle class imbalance
        n_jobs=-1,
        random_state=42,
    )
    rf.fit(X_train, y_train)
    print("  Base RF trained.")

    # ── Calibrate probabilities ─────────────────────────────────
    print("Calibrating with CalibratedClassifierCV (sigmoid)...")
    calibrated_model = CalibratedClassifierCV(
        estimator=rf,
        method="sigmoid",
        cv=5,
        n_jobs=-1,
    )
    calibrated_model.fit(X_train, y_train)
    print("  Calibration complete.")

    # ── Evaluate on test set ────────────────────────────────────
    print("\n" + "=" * 60)
    print("Test-set evaluation (scaffold split)")
    print("=" * 60)

    y_pred = calibrated_model.predict(X_test)
    y_prob = calibrated_model.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    auc = roc_auc_score(y_test, y_prob)

    print(f"  Accuracy:   {acc:.4f}")
    print(f"  Precision:  {prec:.4f}")
    print(f"  Recall:     {rec:.4f}")
    print(f"  F1 Score:   {f1:.4f}")
    print(f"  ROC-AUC:    {auc:.4f}")
    print()
    print("Classification report (default threshold = 0.5):")
    print(classification_report(y_test, y_pred, target_names=["inactive", "active"]))

    # ── Threshold scan ─────────────────────────────────────────
    print("=" * 60)
    print("Threshold scan (0.10 → 0.50, step 0.05)")
    print("=" * 60)
    print(f"  {'Threshold':>10} {'Precision':>11} {'Recall':>8} "
          f"{'F1':>8} {'Accuracy':>10}")
    print("  " + "-" * 52)

    thresholds = np.arange(0.10, 0.51, 0.05)
    scan_results: list[dict] = []

    for t in thresholds:
        y_t = (y_prob >= t).astype(int)
        p = precision_score(y_test, y_t, zero_division=0)
        r = recall_score(y_test, y_t, zero_division=0)
        f = f1_score(y_test, y_t, zero_division=0)
        a = accuracy_score(y_test, y_t)
        scan_results.append(
            {"threshold": round(float(t), 2), "precision": p,
             "recall": r, "f1": f, "accuracy": a}
        )
        print(f"  {t:>10.2f} {p:>11.4f} {r:>8.4f} {f:>8.4f} {a:>10.4f}")

    # Auto-select: best F1 among thresholds with recall >= 0.60
    # (safety use-case — missing a toxic compound is worse than a false alarm)
    candidates = [r for r in scan_results if r["recall"] >= 0.60]
    if candidates:
        best = max(candidates, key=lambda r: r["f1"])
    else:
        # fallback: highest recall overall
        best = max(scan_results, key=lambda r: r["recall"])

    chosen_threshold = best["threshold"]
    print()
    print(f"  ➜ Auto-selected threshold: {chosen_threshold}")
    print(f"    (Recall = {best['recall']:.4f}, "
          f"Precision = {best['precision']:.4f}, "
          f"F1 = {best['f1']:.4f})")

    # ── Save model ──────────────────────────────────────────────
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(calibrated_model, model_path)
    print(f"\nModel saved to {model_path}")

    # ── Save metadata (per docs/04_RULES.md §4) ────────────────
    metadata = {
        "model_name": f"{endpoint}_model",
        "version": 1,
        "description": f"Calibrated RandomForest classifier for {endpoint} activity prediction",
        "target": f"{endpoint} — binary active",
        "training_date": datetime.now(timezone.utc).isoformat(),
        "dataset_source": "ChEMBL 37",
        "split_method": "Murcko scaffold split (80/20)",
        "fingerprint": "Morgan radius=2, 2048 bits",
        "base_estimator": "RandomForestClassifier(n_estimators=500, class_weight='balanced')",
        "calibration": "CalibratedClassifierCV(method='sigmoid', cv=5)",
        "chosen_threshold": chosen_threshold,
        "train_samples": int(X_train.shape[0]),
        "test_samples": int(X_test.shape[0]),
        "metrics_default_0.5": {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "roc_auc": round(auc, 4),
        },
        "metrics_chosen_threshold": {
            "threshold": chosen_threshold,
            "accuracy": round(best["accuracy"], 4),
            "precision": round(best["precision"], 4),
            "recall": round(best["recall"], 4),
            "f1": round(best["f1"], 4),
            "roc_auc": round(auc, 4),
        },
        "threshold_scan": scan_results,
    }
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Metadata saved to {metadata_path}")
    print(f"  (chosen_threshold = {chosen_threshold} is stored for backend use)")
    print("Done.")


if __name__ == "__main__":
    main()
