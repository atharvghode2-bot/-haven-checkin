# Request and response models with input validation.
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


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


class EmotionContextIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    dominant_emotion: str | None = None
    dominant_score: float | None = None
    emotions: dict[str, Any] | None = None
    sample_count: int | None = None
    timestamp: float | None = None
    is_active: bool = True

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "dominantEmotion" in data and "dominant_emotion" not in data:
                data["dominant_emotion"] = data["dominantEmotion"]
            if "dominantScore" in data and "dominant_score" not in data:
                data["dominant_score"] = data["dominantScore"]
            if "sampleCount" in data and "sample_count" not in data:
                data["sample_count"] = data["sampleCount"]
            if "isActive" in data and "is_active" not in data:
                data["is_active"] = data["isActive"]
        return data


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1500)
    conversation_id: str | None = Field(default=None, max_length=64)
    emotion_context: EmotionContextIn | None = None


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str
    provider: str
    model: str
    safety_status: Literal["ok", "crisis_intercepted"] = "ok"
    crisis_resources: list[dict[str, Any]] | None = None


class ChatResetIn(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=64)


class ChatStatusResponse(BaseModel):
    available: bool
    provider: str
    model: str
    installed_models: list[str] = []
    message: str


class MessageAnalysisIn(BaseModel):
    message: str = Field(min_length=1, max_length=1500)


class MessageAnalysisOut(BaseModel):
    message_id: str
    timestamp: float
    sentiment: str
    scores: dict[str, float]
    confidence: float
    source: str
    is_trained_model: bool
    limitations: str
    themes: list[str] = []


class ClientFaceSummaryIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    sample_count: int = Field(default=0, ge=0)
    dominant_emotion: str | None = None
    dominant_score: float | None = None
    distribution: dict[str, float] | None = None
    mean_scores: dict[str, float] | None = None
    trajectory: str | None = None
    timestamp: float | None = None
    is_active: bool = True
    is_stale: bool = False

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "sampleCount" in data and "sample_count" not in data:
                data["sample_count"] = data["sampleCount"]
            if "dominantEmotion" in data and "dominant_emotion" not in data:
                data["dominant_emotion"] = data["dominantEmotion"]
            if "dominantScore" in data and "dominant_score" not in data:
                data["dominant_score"] = data["dominantScore"]
            if "meanScores" in data and "mean_scores" not in data:
                data["mean_scores"] = data["meanScores"]
            if "isActive" in data and "is_active" not in data:
                data["is_active"] = data["isActive"]
            if "isStale" in data and "is_stale" not in data:
                data["is_stale"] = data["isStale"]
        return data


class ReportRequestIn(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=64)
    face_summary: ClientFaceSummaryIn | None = None


class ClearAnalysisResponse(BaseModel):
    ok: bool
    conversation_id: str
    message: str

