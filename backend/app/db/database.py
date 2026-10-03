"""
ROGVEDA — SQLite database connection via SQLAlchemy

All data lives locally (see docs/05_SECURITY.md §2).
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import DB_PATH


engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},  # required for SQLite + FastAPI
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


def get_db():
    """FastAPI dependency — yields a DB session, auto-closes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables if they don't exist yet."""
    Base.metadata.create_all(bind=engine)

    # ── Migrations for existing DBs ───────────────────────
    # Add parent_experiment_id column if missing (Phase 10)
    with engine.connect() as conn:
        try:
            conn.execute(
                __import__("sqlalchemy").text(
                    "ALTER TABLE experiments ADD COLUMN parent_experiment_id INTEGER"
                )
            )
            conn.commit()
        except Exception:
            # Column already exists — safe to ignore
            pass
