import pandas as pd
from pathlib import Path

# Paths
IN_DIR = Path("data/tdc_datasets")
OUT_DIR = Path("data/processed")
OUT_DIR.mkdir(parents=True, exist_ok=True)

print("Preparing Tox21...")
try:
    df_tox = pd.read_csv(IN_DIR / "tox21.csv")
    assay_cols = [c for c in df_tox.columns if c not in ['smiles', 'mol_id']]
    df_tox[assay_cols] = df_tox[assay_cols].fillna(0)
    df_tox['active_bin'] = df_tox[assay_cols].max(axis=1)
    
    out_tox = pd.DataFrame({
        "canonical_smiles": df_tox["smiles"],
        "standard_value": df_tox["active_bin"].apply(lambda x: 1 if x == 1 else 100000)
    })
    out_tox.to_csv(OUT_DIR / "tox21_raw.csv", index=False)
    print(f"Saved {len(out_tox)} rows to data/processed/tox21_raw.csv (Actives: {df_tox['active_bin'].sum()})")
except Exception as e:
    print(f"Error preparing Tox21: {e}")

print("Preparing ClinTox...")
try:
    df_clin = pd.read_csv(IN_DIR / "clintox.csv")
    out_clin = pd.DataFrame({
        "canonical_smiles": df_clin["smiles"],
        "standard_value": df_clin["CT_TOX"].apply(lambda x: 1 if x == 1 else 100000)
    })
    out_clin.to_csv(OUT_DIR / "clintox_raw.csv", index=False)
    print(f"Saved {len(out_clin)} rows to data/processed/clintox_raw.csv (Actives: {df_clin['CT_TOX'].sum()})")
except Exception as e:
    print(f"Error preparing ClinTox: {e}")
