from tdc.single_pred import HTS, Tox
import pandas as pd
from pathlib import Path

out_dir = Path("data/raw")
out_dir.mkdir(exist_ok=True)

# 1. Anti-inflammatory / COX-2 dataset
data = HTS(name='SARS-CoV2_In_Vitro_Screen') # Example as requested
data.get_data().to_csv(out_dir / "tdc_sars_cov2_in_vitro.csv", index=False)
