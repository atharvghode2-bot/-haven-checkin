# Request and response models with input validation.
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    role: Literal["student", "counselor"] = "student"


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ConsentIn(BaseModel):
    camera: bool = False
    voice: bool = False
    data_processing: bool = True


class SessionStartIn(BaseModel):
    camera_consent: bool = False
    voice_consent: bool = False


class AnswerIn(BaseModel):
    item_id: str = Field(min_length=3, max_length=32)
    value: Any = None
    text: str | None = Field(default=None, max_length=2000)
    face_emotion_scores: dict[str, float] | None = None
    face_sample_count: int | None = Field(default=None, ge=0)


class FinishIn(BaseModel):
    face_emotions: dict[str, float] | None = None
    face_sample_count: int | None = Field(default=None, ge=0)
    face_model_version: str | None = Field(default=None, max_length=64)
    idempotency_key: str | None = Field(default=None, max_length=64)


class AlertStatusIn(BaseModel):
    status: Literal["open", "acknowledged", "in_review", "resolved"]


class AlertNoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
