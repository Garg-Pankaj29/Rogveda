"""
ROGVEDA — Authentication API endpoints

POST /api/auth/signup  — create a new local user
POST /api/auth/login   — verify credentials, return JWT
GET  /api/auth/me      — return current user from token
GET  /api/auth/stats   — return dashboard stat counts
"""

import csv
from pathlib import Path

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.db.database import get_db
from app.db.models import User
from app.schemas.auth_schemas import (
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    VerifySecurityAnswerRequest,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer_scheme = HTTPBearer()


# ── Helpers ────────────────────────────────────────────

def _get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Dependency: extract and validate the JWT, return the User row."""
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )
    user_id = int(user_id_str)
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


# ── Endpoints ──────────────────────────────────────────

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Register a new local user."""
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        display_name=body.display_name,
        email=body.email,
        password_hash=hash_password(body.password),
        security_question=body.security_question,
        security_answer_hash=hash_password(body.security_answer.strip().lower()),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Authenticate with email + password, receive a JWT."""
    user = db.query(User).filter(User.email == body.email).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No user found, do signup first",
        )
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(_get_current_user)) -> UserResponse:
    """Return the currently authenticated user's info."""
    return current_user


@router.get("/stats")
def get_dashboard_stats(
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db)
):
    """Return dashboard stat counts (real data)."""
    # ── Reference molecules ─────────────
    # The project contains ~235,900 curated molecules across all endpoints.
    # The reference_molecules.csv is only a 10k subset for similarity searching.
    ref_count = 235900

    # ── Experiments & Documents counts ──
    from app.db.models import Experiment, SavedDocument
    exp_count = db.query(Experiment).filter(Experiment.user_id == current_user.id).count()
    doc_count = db.query(SavedDocument).filter(SavedDocument.user_id == current_user.id).count()

    return {
        "total_experiments": exp_count,
        "saved_documents": doc_count,
        "reference_molecules": ref_count,
    }


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Look up a user by email and return their security question."""
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address."
        )
    
    return {
        "security_question": user.security_question
    }


@router.post("/verify-security-answer")
def verify_security_answer(body: VerifySecurityAnswerRequest, db: Session = Depends(get_db)):
    """Verify the security answer and return a password reset token."""
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    if not verify_password(body.security_answer.strip().lower(), user.security_answer_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect security answer."
        )

    # Valid answer, generate token
    token = create_access_token(
        {"sub": str(user.id), "type": "reset"},
        expires_delta=timedelta(minutes=15)
    )
    print(f"--- LOCAL DEV ONLY: Password reset token for {user.email}: {token} ---")
    
    return {
        "message": "Security answer verified.",
        "local_reset_token": token
    }


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using the reset token."""
    payload = decode_access_token(body.token)
    if payload is None or payload.get("type") != "reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token"
        )
        
    user = db.query(User).filter(User.id == int(user_id_str)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password has been successfully reset."}
