"""
ROGVEDA — Pydantic request/response schemas for authentication
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ── Requests ───────────────────────────────────────────

class SignupRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    security_question: str = Field(..., min_length=5, max_length=255)
    security_answer: str = Field(..., min_length=1, max_length=255)


class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class VerifySecurityAnswerRequest(BaseModel):
    email: str
    security_answer: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6, max_length=128)


# ── Responses ──────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    display_name: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}
