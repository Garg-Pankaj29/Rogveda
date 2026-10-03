import sqlite3
import csv
import sys
from pathlib import Path

# Setup paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(PROJECT_ROOT / "scripts"))
from config import CHEMBL_DB_PATH

OUTPUT_CSV = PROJECT_ROOT / "data" / "processed" / "chembl_herg_raw.csv"

def extract_data():
    db_path = Path(CHEMBL_DB_PATH)
    if not db_path.exists():
        print(f"Error: Database not found at {db_path}")
        sys.exit(1)

    print(f"Connecting to {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    query = """
    SELECT cs.canonical_smiles, act.standard_value
    FROM activities act
    JOIN compound_structures cs ON act.molregno = cs.molregno
    JOIN assays ass ON act.assay_id = ass.assay_id
    JOIN target_dictionary td ON ass.tid = td.tid
    WHERE td.pref_name IN ('HERG', 'Voltage-gated inwardly rectifying potassium channel KCNH2')
      AND act.standard_type = 'IC50'
      AND act.standard_units = 'nM'
      AND act.standard_relation = '='
      AND ass.confidence_score >= 8
    """

    print("Executing query...")
    cursor.execute(query)
    rows = cursor.fetchall()
    
    print(f"Writing to {OUTPUT_CSV}...")
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["canonical_smiles", "standard_value"])
        writer.writerows(rows)
        
    print(f"Extraction complete. {len(rows)} rows were extracted.")

if __name__ == "__main__":
    extract_data()
