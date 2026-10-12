# Optional Hugging Face sentiment with a local lexicon fallback. Never used for crisis decisions.
from __future__ import annotations

import logging

import httpx

from .config import get_settings

log = logging.getLogger("haven.nlp")

NEGATIVE = {
    "sad", "depressed", "hopeless", "anxious", "panic", "worthless", "empty",
    "tired", "exhausted", "lonely", "afraid", "scared", "overwhelmed", "cry",
    "crying", "hate", "useless", "failure", "insomnia", "numb", "miserable",
}
POSITIVE = {
    "okay", "ok", "fine", "better", "hope", "calm", "supported", "grateful",
    "good", "improving", "managed", "rested", "safe", "connected",
}


def lexicon_risk(text: str) -> float:
    tokens = [token.strip(".,!?;:\"'").lower() for token in text.split()]
    if not tokens:
        return 50.0
    neg = sum(1 for token in tokens if token in NEGATIVE)
    pos = sum(1 for token in tokens if token in POSITIVE)
    score = 50 + (neg * 12) - (pos * 10)
    return float(max(5.0, min(95.0, score)))


def _hf_to_risk(label: str, score: float) -> float:
    label_l = label.lower()
    if "neg" in label_l or label_l.endswith("1") or "label_0" in label_l:
        return round(50 + score * 50, 2)
    if "pos" in label_l or "label_2" in label_l:
        return round(50 - score * 50, 2)
    return 50.0


async def text_sentiment_score(text: str | None) -> tuple[float | None, str]:
    if not text:
        return None, "skipped"
    settings = get_settings()
    if settings.hf_api_token:
        url = f"https://api-inference.huggingface.co/models/{settings.hf_sentiment_model}"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.post(
                    url,
                    headers={"Authorization": f"Bearer {settings.hf_api_token}"},
                    json={"inputs": text[:1000]},
                )
            response.raise_for_status()
            payload = response.json()
            rows = payload[0] if isinstance(payload, list) and payload else payload
            if isinstance(rows, list) and rows:
                best = max(rows, key=lambda row: row.get("score", 0))
                return _hf_to_risk(str(best.get("label", "")), float(best.get("score", 0))), "huggingface"
        except Exception as exc:  # noqa: BLE001 — optional service must fail closed to lexicon
            log.warning("Hugging Face sentiment unavailable: %s", exc)
    return lexicon_risk(text), "lexicon"


def face_emotion_score(emotions: dict | None) -> float | None:
    """Map aggregated on-device emotion probabilities to a 0–100 distress-oriented score."""
    if not emotions:
        return None
    sad = float(emotions.get("sad", 0) or 0)
    fear = float(emotions.get("fearful", emotions.get("fear", 0)) or 0)
    angry = float(emotions.get("angry", 0) or 0)
    happy = float(emotions.get("happy", 0) or 0)
    neutral = float(emotions.get("neutral", 0) or 0)
    distressed = sad + fear + angry
    eased = happy + 0.4 * neutral
    raw = 50 + (distressed * 80) - (eased * 40)
    return round(max(0.0, min(100.0, raw)), 2)
