"""
ROGVEDA — Application Configuration

All paths are local; all servers bind to 127.0.0.1 only.
No runtime internet calls — see docs/04_RULES.md §2.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# ── Paths ──────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parents[3]  # rogveda/

# Load environment variables from backend/.env or root .env
load_dotenv(PROJECT_ROOT / "backend" / ".env")
load_dotenv(PROJECT_ROOT / ".env")

DATA_DIR = Path(os.getenv("DATA_DIR", str(PROJECT_ROOT / "data")))
MODELS_DIR = Path(os.getenv("MODELS_DIR", str(DATA_DIR / "models")))
DB_PATH = Path(os.getenv("DATABASE_PATH", str(PROJECT_ROOT / "backend" / "rogveda.db")))

# ── Server ─────────────────────────────────────────────
HOST = os.getenv("HOST", "127.0.0.1")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

# ── Auth / JWT ─────────────────────────────────────────
# Read secret from environment variable; fall back to dev default if unset
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "rogveda-local-dev-secret-change-in-prod")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", str(60 * 24)))  # 24 hours

# ── Local LLM (used later, not by auth) ───────────────
LLM_ENDPOINT = os.getenv("LLM_ENDPOINT", "http://127.0.0.1:1234/v1")
