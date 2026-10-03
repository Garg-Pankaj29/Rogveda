import pandas as pd
from pathlib import Path

coadd_path = Path('data/raw/coadd_antimicrobial.csv')
antimicrobial_path = Path('data/processed/antimicrobial_raw.csv')

print("Loading CO-ADD...")
df_coadd = pd.read_csv(coadd_path, low_memory=False)

# Map INHIB_AVE to standard_value (MIC-equivalent)
# Active: INHIB_AVE >= 80 -> standard_value = 1000 (nM)
# Inactive: INHIB_AVE < 80 -> standard_value = 20000 (nM)
df_coadd['standard_value'] = df_coadd['INHIB_AVE'].apply(lambda x: 1000 if pd.notnull(x) and x >= 80 else 20000)
df_coadd = df_coadd[['SMILES', 'standard_value']].rename(columns={'SMILES': 'canonical_smiles'})
df_coadd = df_coadd.dropna(subset=['canonical_smiles'])

print("Loading ChEMBL antimicrobial...")
df_chembl = pd.read_csv(antimicrobial_path)

df_merged = pd.concat([df_chembl, df_coadd], ignore_index=True)
print(f"Total antimicrobial rows after merge: {len(df_merged)}")

df_merged.to_csv(antimicrobial_path, index=False)
print("Saved successfully.")
