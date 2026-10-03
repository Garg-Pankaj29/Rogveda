"""
ROGVEDA — FastAPI Application Entrypoint

Binds to 127.0.0.1 only (see docs/05_SECURITY.md §3).
CORS restricted to the local Vite dev server.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.molecule import router as molecule_router
from app.api.chat import router as chat_router
from app.api.experiments import router as experiments_router
from app.api.reports import router as reports_router
from app.api.modification import router as modification_router
from app.api.remediation import router as remediation_router
from app.api.chemical_space import router as chemical_space_router
from app.api.batch import router as batch_router
from app.api.power import router as power_router
from app.core.config import FRONTEND_ORIGIN
from app.db.database import init_db
import threading
from app.services.ml_service import preload_all_models


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create DB tables if needed and preload models."""
    init_db()
    # Preload ML models in background so first request is fast
    threading.Thread(target=preload_all_models, daemon=True).start()
    yield


app = FastAPI(
    title="ROGVEDA API",
    description="Offline-first molecular research workspace — local backend",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — only the local frontend is allowed
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(molecule_router)
app.include_router(chat_router)
app.include_router(experiments_router)
app.include_router(reports_router)
app.include_router(modification_router)
app.include_router(remediation_router)
app.include_router(chemical_space_router)
app.include_router(batch_router)
app.include_router(power_router)


@app.get("/api/health")
def health_check():
    """Simple health probe — useful for run_dev.sh startup checks."""
    return {"status": "ok", "service": "rogveda-backend"}
