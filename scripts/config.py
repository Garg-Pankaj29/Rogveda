import os
from pathlib import Path

# Assuming scripts is inside the root directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CHEMBL_DB_PATH = str(PROJECT_ROOT / "data" / "raw" / "chembl_37.db")
