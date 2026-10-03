"""
ROGVEDA — Extract new ML datasets from ChEMBL 37

This script queries the local ChEMBL SQLite database for bioactivity data 
on four target endpoints: Anti-inflammatory (COX-2), Antioxidant, 
Antimicrobial (S. aureus), and Anticancer (NCI-60).

Outputs are raw CSV files in data/processed/.
"""

import sqlite3
import pandas as pd
from pathlib import Path

# ── Paths ───────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = '/mnt/Shared/chembl_37_sqlite/chembl_37/chembl_37_sqlite/chembl_37.db'
OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Queries ─────────────────────────────────────────────────────
queries = {
    'antiinflammatory': '''
        SELECT cs.canonical_smiles, MIN(a.standard_value) as standard_value
        FROM activities a
        JOIN assays ass ON a.assay_id = ass.assay_id
        JOIN target_dictionary td ON ass.tid = td.tid
        JOIN compound_structures cs ON a.molregno = cs.molregno
        WHERE td.chembl_id IN ('CHEMBL230', 'CHEMBL221', 'CHEMBL1825', 'CHEMBL4550')  -- COX-2, COX-1, TNF, ALOX5
          AND a.standard_type IN ('IC50', 'Ki', 'EC50')
          AND a.standard_value IS NOT NULL
          AND cs.canonical_smiles IS NOT NULL
        GROUP BY cs.canonical_smiles
    ''',
    'antioxidant': '''
        SELECT cs.canonical_smiles, MIN(a.standard_value) as standard_value
        FROM activities a
        JOIN assays ass ON a.assay_id = ass.assay_id
        JOIN compound_structures cs ON a.molregno = cs.molregno
        WHERE (ass.description LIKE '%antioxidant%' OR ass.description LIKE '%DPPH%')
        AND a.standard_type IN ('IC50', 'EC50')
        AND a.standard_relation = '='
        AND a.standard_value IS NOT NULL
        AND cs.canonical_smiles IS NOT NULL
        GROUP BY cs.canonical_smiles
    ''',
    'antimicrobial': '''
        SELECT cs.canonical_smiles, MIN(a.standard_value) as standard_value
        FROM activities a
        JOIN assays ass ON a.assay_id = ass.assay_id
        JOIN target_dictionary td ON ass.tid = td.tid
        JOIN compound_structures cs ON a.molregno = cs.molregno
        WHERE td.organism = 'Staphylococcus aureus'
        AND a.standard_type = 'MIC'
        AND a.standard_relation = '='
        AND a.standard_value IS NOT NULL
        AND cs.canonical_smiles IS NOT NULL
        GROUP BY cs.canonical_smiles
    ''',
    'anticancer': '''
        SELECT cs.canonical_smiles, MIN(a.standard_value) as standard_value
        FROM activities a
        JOIN assays ass ON a.assay_id = ass.assay_id
        JOIN compound_structures cs ON a.molregno = cs.molregno
        WHERE (ass.description LIKE '%cancer%' OR ass.description LIKE '%cytotox%' OR ass.description LIKE '%tumor%')
          AND a.standard_type IN ('IC50', 'GI50', 'EC50')
          AND a.standard_value IS NOT NULL
          AND cs.canonical_smiles IS NOT NULL
        GROUP BY cs.canonical_smiles
        LIMIT 50000
    '''
}

def main():
    print(f"Connecting to {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    
    for endpoint, query in queries.items():
        print(f"Extracting data for {endpoint}...")
        df = pd.read_sql_query(query, conn)
        
        output_file = OUTPUT_DIR / f"{endpoint}_raw.csv"
        df.to_csv(output_file, index=False)
        print(f"  Saved {len(df)} rows to {output_file.name}")
        
    conn.close()
    print("Done!")

if __name__ == "__main__":
    main()
