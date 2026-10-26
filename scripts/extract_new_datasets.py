"""
ROGVEDA — Extract Augmented ML datasets from ChEMBL 37 & Processed Stores

Expands dataset coverage for:
- antiinflammatory (16 validated targets: COX-1/2, TNF, 5-LOX, FLAP, iNOS, p38 MAPK, PDE4B/D, IKK-b, IL-1/2/8, JAK1/2/3)
- antioxidant (multi-assay radical scavenging: DPPH, ABTS, FRAP, lipid peroxidation, superoxide, ROS)
- herg (Voltage-gated potassium channel KCNH2 IC50/Ki/EC50/Kd)

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

# ── Expanded Queries ─────────────────────────────────────────────
queries = {
    'antiinflammatory': '''
        SELECT cs.canonical_smiles, MIN(a.standard_value) as standard_value
        FROM activities a
        JOIN assays ass ON a.assay_id = ass.assay_id
        JOIN target_dictionary td ON ass.tid = td.tid
        JOIN compound_structures cs ON a.molregno = cs.molregno
        WHERE td.chembl_id IN (
            'CHEMBL230',  -- COX-2
            'CHEMBL221',  -- COX-1
            'CHEMBL1825', -- TNF-alpha
            'CHEMBL4550', -- ALOX5AP (FLAP)
            'CHEMBL215',  -- 5-LOX (ALOX5)
            'CHEMBL3464', -- iNOS (NOS2)
            'CHEMBL260',  -- p38 MAPK alpha (MAPK14)
            'CHEMBL287',  -- PDE4B
            'CHEMBL284',  -- PDE4D
            'CHEMBL2971', -- IKK-beta (IKBKB)
            'CHEMBL1959', -- IL-1R1
            'CHEMBL2466', -- IL-2
            'CHEMBL2157', -- IL-8
            'CHEMBL2835', -- JAK1
            'CHEMBL2980', -- JAK2
            'CHEMBL2147'  -- JAK3
        )
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
        WHERE (
            ass.description LIKE '%antioxidant%' 
            OR ass.description LIKE '%DPPH%' 
            OR ass.description LIKE '%radical scaveng%' 
            OR ass.description LIKE '%ABTS%'
            OR ass.description LIKE '%FRAP%'
            OR ass.description LIKE '%lipid peroxidation%'
            OR ass.description LIKE '%reactive oxygen%'
            OR ass.description LIKE '%superoxide%'
        )
        AND a.standard_type IN ('IC50', 'EC50')
        AND a.standard_value IS NOT NULL
        AND cs.canonical_smiles IS NOT NULL
        GROUP BY cs.canonical_smiles
    ''',
    'herg': '''
        SELECT cs.canonical_smiles, MIN(a.standard_value) as standard_value
        FROM activities a
        JOIN assays ass ON a.assay_id = ass.assay_id
        JOIN target_dictionary td ON ass.tid = td.tid
        JOIN compound_structures cs ON a.molregno = cs.molregno
        WHERE td.chembl_id = 'CHEMBL240'
          AND a.standard_type IN ('IC50', 'Ki', 'EC50', 'Inhibition', 'Kd')
          AND a.standard_value IS NOT NULL
          AND cs.canonical_smiles IS NOT NULL
        GROUP BY cs.canonical_smiles
    '''
}

def main():
    print(f"Connecting to {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    
    for endpoint, query in queries.items():
        print(f"Extracting augmented data for {endpoint}...")
        df = pd.read_sql_query(query, conn)
        
        if endpoint == 'herg':
            output_file = OUTPUT_DIR / "chembl_herg_raw.csv"
        else:
            output_file = OUTPUT_DIR / f"{endpoint}_raw.csv"
            
        df.to_csv(output_file, index=False)
        print(f"  ✓ Saved {len(df)} rows to {output_file.name}")
        
    conn.close()
    print("Done extracting augmented datasets!")

if __name__ == "__main__":
    main()
