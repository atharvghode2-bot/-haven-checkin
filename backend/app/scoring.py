# Deterministic questionnaire scoring and fusion. Weights are provisional until clinically reviewed.
from __future__ import annotations

import re
from typing import Any

PHQ9_MAX = 27
GAD7_MAX = 21
CRISIS_KEYWORDS = (
    "kill myself",
    "suicide",
    "suicidal",
    "end my life",
    "want to die",
    "better off dead",
    "self harm",
    "self-harm",
    "hurt myself",
    "cutting myself",
    "end it all",
    "take my life",
    "hang myself",
)

# Verified crisis resources for immediate support (India Tele-MANAS & Helplines)
CRISIS_RESOURCES = [
    {
        "name": "Tele-MANAS (Govt. of India)",
        "contact": "14416",
        "alt_contact": "1800-891-4416",
        "hours": "24/7 Toll-Free",
        "description": "National Tele Mental Health Programme offering free, confidential multi-lingual counseling.",
        "type": "tele_manas",
    },
    {
        "name": "KIRAN Mental Health Helpline",
        "contact": "1800-599-0019",
        "alt_contact": "",
        "hours": "24/7 Toll-Free",
        "description": "Ministry of Social Justice & Empowerment helpline for psychological support and rehabilitation.",
        "type": "helpline",
    },
    {
        "name": "National Emergency Number",
        "contact": "112",
        "alt_contact": "102 (Ambulance)",
        "hours": "24/7 Immediate",
        "description": "Single emergency response number for immediate medical, police, or safety intervention.",
        "type": "emergency",
    },
    {
        "name": "Vandrevala Foundation",
        "contact": "+91 9999 666 555",
        "alt_contact": "",
        "hours": "24/7 Call & WhatsApp",
        "description": "Free mental health and crisis intervention service with trained counselors.",
        "type": "counseling",
    },
]

# Provisional bands on a 0–100 fused scale.
BAND_MODERATE = 35
BAND_HIGH = 60
# Face emotion must not independently create a high-risk alert.
FACE_ALERT_GUARD = 40


def phq9_total(answers: dict[str, Any]) -> int:
    return sum(int(answers.get(f"phq9_{i}", 0) or 0) for i in range(1, 10))


def gad7_total(answers: dict[str, Any]) -> int:
    return sum(int(answers.get(f"gad7_{i}", 0) or 0) for i in range(1, 8))


def questionnaire_score_100(phq9: int, gad7: int) -> float:
    """Normalize PHQ-9 and GAD-7 to 0–100, then average."""
    phq_n = max(0.0, min(100.0, (phq9 / PHQ9_MAX) * 100))
    gad_n = max(0.0, min(100.0, (gad7 / GAD7_MAX) * 100))
    return round((0.5 * phq_n) + (0.5 * gad_n), 2)


def crisis_from_phq9(answers: dict[str, Any]) -> bool:
    return int(answers.get("phq9_9", 0) or 0) > 0


def crisis_from_text(text: str | None) -> bool:
    if not text:
        return False
    lowered = text.lower()
    return any(keyword in lowered for keyword in CRISIS_KEYWORDS)


def band_for(score: float, crisis: bool) -> str:
    if crisis or score >= BAND_HIGH:
        return "elevated"
    if score >= BAND_MODERATE:
        return "moderate"
    return "lower"


def should_notify_counselor(
    *,
    fused: float,
    questionnaire: float,
    crisis: bool,
    face_used: bool,
) -> bool:
    if crisis:
        return True
    if fused >= BAND_HIGH and (not face_used or questionnaire >= FACE_ALERT_GUARD):
        return True
    return False


def fuse_scores(
    questionnaire: float,
    text_sentiment: float | None,
    face_emotion: float | None,
    face_consented: bool,
) -> tuple[float, dict[str, float]]:
    """
    Architecture formula (components already on 0–100):
    final_risk = 0.5 * questionnaire + 0.3 * text + 0.2 * face
    Missing optional signals are dropped and remaining weights are renormalized.
    """
    weights: dict[str, float] = {"questionnaire": 0.5}
    values: dict[str, float] = {"questionnaire": questionnaire}
    if text_sentiment is not None:
        weights["text"] = 0.3
        values["text"] = text_sentiment
    if face_consented and face_emotion is not None:
        weights["face"] = 0.2
        values["face"] = face_emotion

    total_w = sum(weights.values()) or 1.0
    fused = sum((weights[key] / total_w) * values[key] for key in weights)
    return round(fused, 2), {key: round(weight / total_w, 3) for key, weight in weights.items()}


def self_help_for(band: str) -> list[dict[str, str]]:
    shared = [
        {
            "title": "Keep a short check-in rhythm",
            "body": "A brief, regular check-in can help you notice patterns without waiting for a crisis.",
        },
        {
            "title": "Talk with someone you trust",
            "body": "A friend, family member, or campus counselor can help you think through what you need.",
        },
    ]
    if band == "elevated":
        return [
            {
                "title": "Reach campus or crisis support today",
                "body": "These results suggest extra support would be useful. You do not have to handle this alone.",
            },
            {
                "title": "Reduce isolation for the next 24 hours",
                "body": "Stay near people you trust, keep your space as safe as you can, and use a crisis line if thoughts of harm intensify.",
            },
            *shared,
        ]
    if band == "moderate":
        return [
            {
                "title": "Protect sleep and meals",
                "body": "Irregular sleep and skipped meals often amplify stress. Aim for a consistent wind-down tonight.",
            },
            {
                "title": "Use one grounding practice",
                "body": "Try a 5-minute walk, paced breathing, or writing down one worry and one next step.",
            },
            *shared,
        ]
    return [
        {
            "title": "Keep the habits that are working",
            "body": "Your responses suggest a lower current load. Continue routines that help you recover after busy weeks.",
        },
        {
            "title": "Notice early changes",
            "body": "If sleep, interest, or worry shift for more than a week, another check-in can help you catch it early.",
        },
        *shared,
    ]


def sanitize_open_text(text: str | None) -> str | None:
    if text is None:
        return None
    cleaned = re.sub(r"\s+", " ", text).strip()
    return cleaned[:2000] if cleaned else None
