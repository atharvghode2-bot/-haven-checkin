"""Deterministic crisis safety and ethical guardrails for Haven AI Chatbot.

Provides a safety layer completely independent of the LLM or emotion detectors.
Automated safety checks are fallible and never presented as clinical crisis predictors.
Never invents helpline numbers: only uses verified national and campus emergency contacts.
"""
from __future__ import annotations

import re
from typing import Any

# Verified crisis resources with explicit geographic and operational scope.
VERIFIED_CRISIS_RESOURCES: list[dict[str, str]] = [
    {
        "name": "Tele-MANAS (Govt. of India)",
        "contact": "14416",
        "alt_contact": "1800-891-4416",
        "hours": "24/7 Toll-Free",
        "description": "National Tele Mental Health Programme offering free, confidential multi-lingual counseling across India.",
        "region": "India",
        "type": "tele_manas",
    },
    {
        "name": "KIRAN Mental Health Helpline",
        "contact": "1800-599-0019",
        "alt_contact": "",
        "hours": "24/7 Toll-Free",
        "description": "Ministry of Social Justice & Empowerment helpline for psychological support and crisis management.",
        "region": "India",
        "type": "helpline",
    },
    {
        "name": "National Emergency Number",
        "contact": "112",
        "alt_contact": "102 (Ambulance)",
        "hours": "24/7 Immediate",
        "description": "Unified emergency response number for immediate medical, police, or safety intervention.",
        "region": "India",
        "type": "emergency",
    },
    {
        "name": "Vandrevala Foundation",
        "contact": "+91 9999 666 555",
        "alt_contact": "",
        "hours": "24/7 Call & WhatsApp",
        "description": "Free mental health and crisis intervention service with trained counselors.",
        "region": "India / International WhatsApp",
        "type": "counseling",
    },
    {
        "name": "988 Suicide & Crisis Lifeline",
        "contact": "988",
        "alt_contact": "Text 988",
        "hours": "24/7 Call & Text",
        "description": "Free, confidential crisis counseling and suicide prevention service.",
        "region": "United States & Canada",
        "type": "lifeline",
    },
    {
        "name": "Crisis Text Line",
        "contact": "Text HOME to 741741",
        "alt_contact": "",
        "hours": "24/7 Free Text Support",
        "description": "Connect with a volunteer crisis counselor via free SMS support.",
        "region": "US / UK (85258) / Canada (686868)",
        "type": "text_support",
    },
]

# High-risk patterns indicating immediate self-harm, suicidal ideation, or acute danger.
CRISIS_PATTERNS = [
    r"\b(?:kill|end|take)\s+(?:my\s*self|my\s*life)\b",
    r"\b(?:suicide|suicidal)\b",
    r"\b(?:want|wish|ready)\s+to\s+die\b",
    r"\bbetter\s+off\s+dead\b",
    r"\b(?:self[- ]?harm|harm(?:ing)?\s+myself|hurt(?:ing)?\s+myself)\b",
    r"\b(?:cut|cutting)\s+my\s*(?:wrists|arms|thighs|body|self)\b",
    r"\b(?:hang|hanging)\s+myself\b",
    r"\b(?:overdose|swallow\s+all\s+my\s+pills|take\s+all\s+my\s+pills)\b",
    r"\bend\s+it\s+all\b",
    r"\bdon'?t\s+want\s+to\s+(?:live|be\s+here|wake\s+up)\s+any\s*more\b",
    r"\bno\s+reason\s+to\s+live\b",
    r"\bjump(?:ing)?\s+off\s+a\s+(?:bridge|building|roof)\b",
]

COMPILED_CRISIS_REGEXES = [re.compile(p, re.IGNORECASE) for p in CRISIS_PATTERNS]

# Prompt injection and adversarial override patterns attempting to break persona or safety
INJECTION_PATTERNS = [
    r"\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions\b",
    r"\bdisregard\s+(?:system\s+prompt|safety|guidelines)\b",
    r"\byou\s+are\s+now\s+(?:dan|evil|unrestricted|a\s+doctor)\b",
    r"\bact\s+as\s+(?:a\s+licensed\s+psychiatrist|a\s+doctor|a\s+therapist)\s+and\s+diagnose\b",
]
COMPILED_INJECTION_REGEXES = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]


class CrisisDetectionResult:
    def __init__(
        self,
        is_crisis: bool,
        matched_trigger: str | None = None,
        deescalation_reply: str | None = None,
        resources: list[dict[str, str]] | None = None,
    ) -> None:
        self.is_crisis = is_crisis
        self.matched_trigger = matched_trigger
        self.deescalation_reply = deescalation_reply
        self.resources = resources or []


def evaluate_crisis_risk(text: str | None) -> CrisisDetectionResult:
    """Deterministic crisis detection independent of the LLM or facial signals.

    Returns a structured CrisisDetectionResult. If a crisis phrase is detected,
    returns an immediate empathetic de-escalation response and verified resources.
    """
    if not text or not text.strip():
        return CrisisDetectionResult(is_crisis=False)

    cleaned = text.strip()
    for regex in COMPILED_CRISIS_REGEXES:
        match = regex.search(cleaned)
        if match:
            trigger = match.group(0)
            deescalation_reply = (
                "I hear how much pain you are holding right now, and I want you to know that your safety "
                "matters deeply. I am an AI assistant and cannot provide medical care, but you do not have "
                "to carry this alone. If you are in immediate danger, please reach out to someone you trust "
                "or contact one of the verified 24/7 crisis helplines below right now. There are compassionate "
                "people trained to listen and support you without judgment."
            )
            return CrisisDetectionResult(
                is_crisis=True,
                matched_trigger=trigger,
                deescalation_reply=deescalation_reply,
                resources=VERIFIED_CRISIS_RESOURCES,
            )

    return CrisisDetectionResult(is_crisis=False)


def sanitize_student_input(text: str, max_chars: int = 1500) -> str:
    """Sanitize student chat text: strip control chars, normalize whitespace, enforce char limit."""
    if not text:
        return ""
    # Strip null bytes and non-printable control characters except newline and tab
    cleaned = "".join(ch for ch in text if ch in ("\n", "\t") or ch >= " ")
    cleaned = re.sub(r"\r\n|\r", "\n", cleaned)
    cleaned = re.sub(r"[ \t]+", " ", cleaned).strip()
    return cleaned[:max_chars]


def contains_prompt_injection(text: str) -> bool:
    """Detect common adversarial prompt injection patterns."""
    for regex in COMPILED_INJECTION_REGEXES:
        if regex.search(text):
            return True
    return False


VALID_EMOTION_KEYS = frozenset({"neutral", "happy", "sad", "angry", "fearful", "surprised", "disgusted"})
MAX_EMOTION_FRESHNESS_SECONDS = 15.0


def validate_chat_emotion_context(raw: Any) -> dict[str, Any] | None:
    """Validate client-supplied facial emotion context.

    Enforces:
    - Feature enabled (`is_active` is True).
    - Sufficient sample depth (>= 3 frames to avoid single-frame noise).
    - Freshness: rejected if older than 15 seconds or far future.
    - Canonical emotion categories from genuine FACS blendshape mapping.
    - Scores bounded strictly within [0.0, 1.0].
    - Returns sanitized structure or None if missing, malformed, or stale.
    """
    if raw is None:
        return None

    # Handle both pydantic model and raw dict
    if hasattr(raw, "is_active"):
        if not raw.is_active:
            return None
        dominant_raw = raw.dominant_emotion
        dominant_score_raw = raw.dominant_score
        emotions_raw = raw.emotions
        sample_count_raw = raw.sample_count
        timestamp_raw = raw.timestamp
    elif isinstance(raw, dict):
        if not raw.get("is_active", True):
            return None
        dominant_raw = raw.get("dominant_emotion")
        dominant_score_raw = raw.get("dominant_score")
        emotions_raw = raw.get("emotions")
        sample_count_raw = raw.get("sample_count")
        timestamp_raw = raw.get("timestamp")
    else:
        return None

    # 1. Sample count depth (at least 3 valid observations required)
    if sample_count_raw is None:
        return None
    try:
        sample_count = int(sample_count_raw)
        if sample_count < 3:
            return None
    except (ValueError, TypeError):
        return None

    # 2. Freshness verification
    if timestamp_raw is None:
        return None
    try:
        ts = float(timestamp_raw)
        if ts > 1e11:  # Convert millisecond epoch to seconds
            ts = ts / 1000.0
    except (ValueError, TypeError):
        return None

    import time
    now = time.time()
    age = now - ts
    # Discard if older than threshold or skewed into future by > 5 seconds
    if age > MAX_EMOTION_FRESHNESS_SECONDS or age < -5.0:
        return None

    # 3. Dominant emotion category validation
    dominant = str(dominant_raw or "").lower().strip()
    if dominant not in VALID_EMOTION_KEYS:
        return None

    # 4. Dominant confidence score validation [0.0, 1.0]
    if dominant_score_raw is None:
        return None
    try:
        score = float(dominant_score_raw)
        if not (0.0 <= score <= 1.0):
            return None
    except (ValueError, TypeError):
        return None

    # 5. Sanitize breakdown map if provided
    cleaned_emotions: dict[str, float] = {}
    if emotions_raw and isinstance(emotions_raw, dict):
        for k, v in emotions_raw.items():
            k_clean = str(k).lower().strip()
            if k_clean in VALID_EMOTION_KEYS:
                try:
                    num = float(v)
                    if 0.0 <= num <= 1.0:
                        cleaned_emotions[k_clean] = round(num, 3)
                except (ValueError, TypeError):
                    pass

    return {
        "dominant_emotion": dominant,
        "dominant_score": round(score, 3),
        "emotions": cleaned_emotions,
        "sample_count": sample_count,
        "freshness_seconds": round(max(0.0, age), 1),
    }
