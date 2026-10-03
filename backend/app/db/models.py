"""
ROGVEDA — SQLAlchemy ORM models

Matches the data model in docs/03_ARCHITECTURE.md §3.
Only the User model is needed for auth; the rest will be added
as features are built.
"""

from datetime import datetime, timezone

from sqlalchemy import Integer, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    security_question: Mapped[str] = mapped_column(String(255), nullable=False)
    security_answer_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False) # Not enforcing true ForeignKey to keep offline sync simpler for now if multiple users exist, but typically ForeignKey("users.id")
    local_id: Mapped[str] = mapped_column(String(50), nullable=True, index=True) # To map local UUID to DB ID
    name: Mapped[str] = mapped_column(String(255), nullable=True)
    molfile: Mapped[str] = mapped_column(Text, nullable=True)
    original_smiles: Mapped[str] = mapped_column(Text, nullable=True)
    modified_smiles: Mapped[str] = mapped_column(Text, nullable=True)
    properties_json: Mapped[str] = mapped_column(Text, nullable=True)
    predictions_json: Mapped[str] = mapped_column(Text, nullable=True)
    similarity_json: Mapped[str] = mapped_column(Text, nullable=True)
    ai_insight: Mapped[str] = mapped_column(Text, nullable=True)
    date: Mapped[str] = mapped_column(String(100), nullable=True) # Storing original ISO string for UI parity
    parent_experiment_id: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)  # links modification chains
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Experiment id={self.id} user_id={self.user_id}>"


class SavedDocument(Base):
    __tablename__ = "saved_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    format: Mapped[str] = mapped_column(String(50), nullable=True)
    html_content: Mapped[str] = mapped_column(Text, nullable=True)
    smiles: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<SavedDocument id={self.id} name={self.name!r}>"


class AnalysisCache(Base):
    __tablename__ = "analysis_cache"
    __table_args__ = (
        __import__("sqlalchemy").UniqueConstraint('canonical_smiles', 'endpoint', name='uix_canonical_smiles_endpoint'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    canonical_smiles: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    model_version: Mapped[str] = mapped_column(String(255), nullable=False)
    rogveda_version: Mapped[str] = mapped_column(String(50), nullable=False)
    endpoint: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # "predict-all" or "ai-summary"
    result_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<AnalysisCache id={self.id} endpoint={self.endpoint} smiles={self.canonical_smiles}>"


class AppSetting(Base):
    """Generic key-value settings table for local app configuration."""
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<AppSetting key={self.key!r} value={self.value!r}>"
