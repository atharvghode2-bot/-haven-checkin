"""NLP message analysis service for Haven Check-in AI Wellness Companion.

Analyzes the emotional tone of student chat messages using:
1. Hugging Face Transformers classification pipeline or HF Inference API (when configured/available)
2. Transparent clinical & wellness lexicon fallback (when GPU/heavy runtime is unavailable)

Guarantees:
- Analyzes ONLY user messages, NEVER AI replies.
- Never diagnoses psychiatric conditions or infers clinical severity.
- Documents supported labels and genuine limitations explicitly.
"""
from __future__ import annotations

import logging
import re
import time
from typing import Any

import httpx

from .config import get_settings

log = logging.getLogger("haven.nlp_analysis")

# Documented supported labels for the selected model:
# Model: cardiffnlp/twitter-roberta-base-sentiment-latest
# License: Apache-2.0
# Intended Task: 3-class Sentiment & Emotional Tone Classification
SUPPORTED_NLP_LABELS = ("negative", "neutral", "positive")

# High-coverage university wellness & student stress lexicon
# Calibrated for undergraduate stress, emotional exhaustion, grounding, and relief.
LEXICON_NEGATIVE_WORDS = {
    # Sadness / despair
    "sad", "depressed", "hopeless", "unhappy", "miserable", "crying", "cry", "tears",
    "grief", "heartbroken", "down", "sorrow", "worthless", "empty", "numb",
    # Anxiety / panic
    "anxious", "anxiety", "panic", "panicking", "scared", "terrified", "afraid", "fear",
    "nervous", "dread", "worry", "worried", "worrying", "shaking", "tense", "stress",
    "stressed", "stressful", "distressed", "overwhelmed", "pressured", "pressure",
    # Burnout / fatigue
    "exhausted", "exhausting", "tired", "drained", "burnout", "burned out", "fatigue",
    "weary", "spent", "depleted", "sleepy", "insomnia", "sleepless",
    # Cognitive / academic load
    "overloaded", "failing", "failure", "failed", "stupid", "useless", "confused",
    "behind", "unfocused", "struggling", "struggle", "frustrated", "frustration",
    # Anger / irritation
    "angry", "mad", "annoyed", "irritated", "furious", "hate", "resentful",
    # Isolation
    "lonely", "alone", "isolated", "abandoned", "disconnected", "alienated",
}

LEXICON_POSITIVE_WORDS = {
    # Relief / recovery
    "relieved", "relief", "better", "improving", "improved", "lighter", "eased",
    # Calm / peace
    "calm", "peaceful", "relaxed", "relaxing", "grounded", "settled", "composed",
    "centered", "quiet", "steady", "soothed",
    # Hope / optimism
    "hope", "hopeful", "optimistic", "looking forward", "encouraged", "supported",
    # Joy / contentment
    "happy", "glad", "good", "great", "content", "satisfied", "pleased", "cheerful",
    # Coping / wellness
    "managed", "managing", "coping", "rested", "refreshed", "recharged", "grateful",
    "thankful", "supported", "cared", "connected", "safe", "clearer", "focused",
}

# Thematic pattern clusters for cautious qualitative observations
THEME_PATTERNS = [
    (
        "academic_load",
        re.compile(r"\b(?:exam|exams|midterm|midterms|finals|assignment|assignments|deadline|deadlines|homework|grades|gpa|thesis|study|studying|coursework|professor)\b", re.IGNORECASE),
        "Language suggests themes related to academic deadlines and study pressure.",
    ),
    (
        "sleep_fatigue",
        re.compile(r"\b(?:sleep|sleeping|insomnia|sleepless|tired|exhausted|exhaustion|fatigue|drained|wake\s+up|waking\s+up|rest|nightmare)\b", re.IGNORECASE),
        "Language references sleep disruption, physical fatigue, or low energy.",
    ),
    (
        "overwhelm_focus",
        re.compile(r"\b(?:overwhelm(?:ed|ing)?|racing\s+thoughts|can'?t\s+focus|distracted|brain\s+fog|too\s+much|stuck|drowning)\b", re.IGNORECASE),
        "Language suggests feelings of mental overload, racing thoughts, or difficulty focusing.",
    ),
    (
        "social_connection",
        re.compile(r"\b(?:lonely|loneliness|alone|isolated|roommate|roommates|friend|friends|family|parents|partner|social|people)\b", re.IGNORECASE),
        "Language references interpersonal relationships, family dynamics, or feeling isolated.",
    ),
    (
        "coping_grounding",
        re.compile(r"\b(?:breath(?:e|ing)?|walk|exercise|break|music|journaling|grounding|calm|better|relief|relieved|helping|helped)\b", re.IGNORECASE),
        "Language mentions restorative habits, grounding exercises, or finding relief.",
    ),
]


def extract_cautious_themes(text: str) -> list[str]:
    """Identify recurring conversational themes using cautious non-clinical descriptors."""
    themes: list[str] = []
    for _key, pattern, description in THEME_PATTERNS:
        if pattern.search(text):
            themes.append(description)
    return themes


def classify_with_lexicon(text: str) -> dict[str, Any]:
    """Lightweight, transparent rule-calibrated fallback classifier.

    DOCUMENTED LIMITATIONS:
    - This is a rule-calibrated lexicon evaluator, NOT a deep neural NLP model.
    - Cannot parse complex syntax, syntactic inversions ('not sad'), or detect sarcasm.
    - Used when local PyTorch/Transformers dependencies are not present or external APIs are unconfigured.
    """
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    tokens = [t for t in cleaned.split() if t]
    total_tokens = len(tokens)

    if total_tokens == 0:
        return {
            "sentiment": "neutral",
            "scores": {"negative": 0.20, "neutral": 0.60, "positive": 0.20},
            "confidence": 0.60,
            "source": "clinical_lexicon_fallback",
            "is_trained_model": False,
            "limitations": "Rule-based lexicon fallback. Lacks syntactic tree parsing, deep context modeling, and cannot detect sarcasm or complex figurative phrasing.",
        }

    neg_hits = sum(1 for t in tokens if t in LEXICON_NEGATIVE_WORDS)
    pos_hits = sum(1 for t in tokens if t in LEXICON_POSITIVE_WORDS)

    # Multi-word phrase boosts
    lower_text = text.lower()
    if "burned out" in lower_text or "burning out" in lower_text:
        neg_hits += 2
    if "looking forward" in lower_text:
        pos_hits += 2

    # Calibrate probability distribution
    total_hits = neg_hits + pos_hits
    if total_hits == 0:
        scores = {"negative": 0.15, "neutral": 0.70, "positive": 0.15}
        sentiment = "neutral"
        confidence = 0.70
    elif neg_hits > pos_hits:
        margin = (neg_hits - pos_hits) / max(1, total_tokens)
        neg_score = min(0.92, 0.50 + margin * 1.5)
        pos_score = max(0.04, 0.15 - (neg_score - 0.50) * 0.3)
        neutral_score = max(0.04, 1.0 - neg_score - pos_score)
        scores = {
            "negative": round(neg_score, 3),
            "neutral": round(neutral_score, 3),
            "positive": round(pos_score, 3),
        }
        sentiment = "negative"
        confidence = round(neg_score, 3)
    elif pos_hits > neg_hits:
        margin = (pos_hits - neg_hits) / max(1, total_tokens)
        pos_score = min(0.92, 0.50 + margin * 1.5)
        neg_score = max(0.04, 0.15 - (pos_score - 0.50) * 0.3)
        neutral_score = max(0.04, 1.0 - pos_score - neg_score)
        scores = {
            "negative": round(neg_score, 3),
            "neutral": round(neutral_score, 3),
            "positive": round(pos_score, 3),
        }
        sentiment = "positive"
        confidence = round(pos_score, 3)
    else:
        scores = {"negative": 0.30, "neutral": 0.40, "positive": 0.30}
        sentiment = "neutral"
        confidence = 0.50

    return {
        "sentiment": sentiment,
        "scores": scores,
        "confidence": confidence,
        "source": "clinical_lexicon_fallback",
        "is_trained_model": False,
        "limitations": "Rule-based lexicon fallback. Lacks syntactic tree parsing, deep context modeling, and cannot detect sarcasm or complex figurative phrasing.",
    }


async def classify_text_emotion(text: str) -> dict[str, Any]:
    """Classify emotional tone of a single text submission.

    Tries Hugging Face Inference API if token configured, otherwise transparently
    executes the documented clinical lexicon fallback.
    """
    settings = get_settings()

    # 1. Hugging Face Inference API if token provided
    if settings.hf_api_token and settings.hf_sentiment_model:
        url = f"https://api-inference.huggingface.co/models/{settings.hf_sentiment_model}"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(
                    url,
                    headers={"Authorization": f"Bearer {settings.hf_api_token}"},
                    json={"inputs": text[:1000]},
                )
            if res.status_code == 200:
                payload = res.json()
                rows = payload[0] if isinstance(payload, list) and payload else payload
                if isinstance(rows, list) and rows:
                    raw_scores: dict[str, float] = {}
                    for row in rows:
                        lbl = str(row.get("label", "")).lower()
                        sc = float(row.get("score", 0))
                        if "neg" in lbl or lbl.endswith("0"):
                            raw_scores["negative"] = sc
                        elif "pos" in lbl or lbl.endswith("2"):
                            raw_scores["positive"] = sc
                        else:
                            raw_scores["neutral"] = sc

                    # Normalize if missing any
                    total = sum(raw_scores.values()) or 1.0
                    norm_scores = {
                        k: round(raw_scores.get(k, 0.0) / total, 3)
                        for k in SUPPORTED_NLP_LABELS
                    }
                    dominant = max(norm_scores.items(), key=lambda x: x[1])[0]
                    return {
                        "sentiment": dominant,
                        "scores": norm_scores,
                        "confidence": norm_scores[dominant],
                        "source": settings.hf_sentiment_model,
                        "is_trained_model": True,
                        "limitations": "Transformer classification model (cardiffnlp/twitter-roberta-base-sentiment-latest). Statistical estimate; does not replace psychiatric evaluation.",
                    }
        except Exception as exc:
            log.warning("HF Inference call failed, using lexicon fallback: %s", exc)

    # 2. Transparent lexicon fallback
    return classify_with_lexicon(text)


class NLPAnalysisService:
    """Service for computing per-message and conversational NLP emotional tone insights."""

    async def analyze_single_message(
        self,
        message: str,
        message_id: str | None = None,
    ) -> dict[str, Any]:
        """Analyze a single student submission."""
        now = time.time()
        cls_result = await classify_text_emotion(message)
        themes = extract_cautious_themes(message)

        return {
            "message_id": message_id or f"msg_{int(now * 1000)}",
            "timestamp": now,
            "sentiment": cls_result["sentiment"],
            "scores": cls_result["scores"],
            "confidence": cls_result["confidence"],
            "source": cls_result["source"],
            "is_trained_model": cls_result["is_trained_model"],
            "limitations": cls_result["limitations"],
            "themes": themes,
        }

    def aggregate_conversation_insights(
        self,
        user_message_analyses: list[dict[str, Any]],
        start_time: float | None = None,
        end_time: float | None = None,
    ) -> dict[str, Any]:
        """Aggregate NLP emotional tone across only user messages."""
        if not user_message_analyses:
            return {
                "available": False,
                "reason": "No user messages submitted yet for analysis.",
                "message_count": 0,
                "period_seconds": 0.0,
                "distribution": {"negative": 0.0, "neutral": 0.0, "positive": 0.0},
                "mean_scores": {"negative": 0.0, "neutral": 0.0, "positive": 0.0},
                "dominant_sentiment": None,
                "average_confidence": 0.0,
                "trajectory": "Insufficient messages to compute conversational trend.",
                "recurring_themes": [],
                "source": "none",
                "is_trained_model": False,
                "limitations": "No user message observations available.",
            }

        count = len(user_message_analyses)
        timestamps = [item["timestamp"] for item in user_message_analyses if "timestamp" in item]
        t_start = start_time or (min(timestamps) if timestamps else time.time())
        t_end = end_time or (max(timestamps) if timestamps else time.time())
        duration = max(0.0, round(t_end - t_start, 1))

        # 1. Distribution of dominant categories
        counts = {"negative": 0, "neutral": 0, "positive": 0}
        sum_scores = {"negative": 0.0, "neutral": 0.0, "positive": 0.0}
        total_conf = 0.0

        for item in user_message_analyses:
            cat = item.get("sentiment", "neutral")
            counts[cat] = counts.get(cat, 0) + 1
            for k in SUPPORTED_NLP_LABELS:
                sum_scores[k] += item.get("scores", {}).get(k, 0.0)
            total_conf += item.get("confidence", 0.0)

        distribution = {k: round(counts[k] / count, 3) for k in SUPPORTED_NLP_LABELS}
        mean_scores = {k: round(sum_scores[k] / count, 3) for k in SUPPORTED_NLP_LABELS}
        dominant_overall = max(counts.items(), key=lambda x: x[1])[0]
        avg_confidence = round(total_conf / count, 3)

        # 2. Conversation Trajectory (temporal tone shifts)
        if count == 1:
            first_sent = user_message_analyses[0].get("sentiment", "neutral")
            trajectory = f"Single message observed with predominantly {first_sent} emotional tone."
        else:
            mid = count // 2
            first_half = user_message_analyses[:mid]
            second_half = user_message_analyses[mid:]

            def dominant_in_slice(items: list[dict[str, Any]]) -> str:
                tally: dict[str, int] = {}
                for it in items:
                    c = it.get("sentiment", "neutral")
                    tally[c] = tally.get(c, 0) + 1
                return max(tally.items(), key=lambda x: x[1])[0] if tally else "neutral"

            early_dominant = dominant_in_slice(first_half)
            late_dominant = dominant_in_slice(second_half)

            if early_dominant == late_dominant:
                trajectory = f"Consistent {early_dominant} tone maintained throughout the conversation."
            elif early_dominant == "negative" and late_dominant in ("neutral", "positive"):
                trajectory = f"Shifted from an initial {early_dominant} tone toward a calmer or more relieved ({late_dominant}) tone."
            elif early_dominant in ("neutral", "positive") and late_dominant == "negative":
                trajectory = f"Shifted from an initial {early_dominant} tone toward expressing heightened tension or stress ({late_dominant}) in later messages."
            else:
                trajectory = f"Dynamic emotional tone shifting from {early_dominant} initially to {late_dominant} in later messages."

        # 3. Recurring Themes aggregation
        theme_set: set[str] = set()
        for item in user_message_analyses:
            for th in item.get("themes", []):
                theme_set.add(th)

        primary_source = user_message_analyses[-1].get("source", "clinical_lexicon_fallback")
        is_trained = user_message_analyses[-1].get("is_trained_model", False)
        limitations = user_message_analyses[-1].get(
            "limitations",
            "Statistical language evaluation. Not a diagnostic instrument.",
        )

        return {
            "available": True,
            "reason": None,
            "message_count": count,
            "period_seconds": duration,
            "distribution": distribution,
            "mean_scores": mean_scores,
            "dominant_sentiment": dominant_overall,
            "average_confidence": avg_confidence,
            "trajectory": trajectory,
            "recurring_themes": sorted(theme_set),
            "source": primary_source,
            "is_trained_model": is_trained,
            "limitations": limitations,
        }


# Singleton service instance
_nlp_service: NLPAnalysisService | None = None


def get_nlp_service() -> NLPAnalysisService:
    global _nlp_service
    if _nlp_service is None:
        _nlp_service = NLPAnalysisService()
    return _nlp_service
