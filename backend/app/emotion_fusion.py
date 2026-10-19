"""Fusion service combining NLP message analysis and facial expression estimates.

Guarantees:
- Never computes an arbitrary combined numerical mental-health severity score.
- Preserves original scores from both sources with transparent attribution.
- Maps categories between sources only along compatible valence dimensions.
- Identifies concordance, divergences, missing data, and stale observations.
- Highlights that the student's written words always take priority over visual cues.
"""
from __future__ import annotations

import logging
import time
from typing import Any

log = logging.getLogger("haven.emotion_fusion")

# Non-judgmental reflective questions for student self-awareness
STANDARD_REFLECTION_QUESTIONS = [
    "Looking at this summary, does it reflect what you were experiencing during your check-in?",
    "Were there specific topics (such as coursework, sleep, or personal life) that shifted your energy the most?",
    "If tension was observed, did it feel related to emotional stress, or simply screen focus and reading concentration?",
    "What small, compassionate step (like taking a pause, getting water, or resting your eyes) would feel most supportive right now?",
]

# Verified supportive wellness resources
WELLNESS_RESOURCES = [
    {
        "title": "Campus Mental Health & Wellness Center",
        "description": "Confidential counseling appointments, walk-in triage hours, and student peer support circles.",
        "category": "campus",
    },
    {
        "title": "Tele-MANAS (Govt. of India)",
        "contact": "14416 (or 1800-891-4416)",
        "description": "24/7 Free, confidential multi-lingual psychological support and crisis counseling.",
        "category": "helpline",
    },
    {
        "title": "KIRAN Mental Health Helpline",
        "contact": "1800-599-0019",
        "description": "24/7 National helpline for psychological first-aid and anxiety management.",
        "category": "helpline",
    },
    {
        "title": "Grounding Practices (4-7-8 Breathing & 5-4-3-2-1 Sensory Reset)",
        "description": "Simple somatic exercises to activate the parasympathetic nervous system during periods of study overwhelm.",
        "category": "self_care",
    },
]

REPORT_DISCLAIMER = (
    "This Emotional Insights Report compiles observational estimates from your written chat messages "
    "and optional browser-based facial tracking. It is an experimental academic reflection tool, NOT a diagnostic "
    "instrument. It does not establish a clinical diagnosis, calculate psychiatric severity, or substitute "
    "for a qualified healthcare provider. If you are experiencing distress, connecting with a licensed clinician "
    "or trusted person is warmly encouraged."
)


def map_face_to_valence(dominant_face: str | None) -> str | None:
    """Map canonical 7-class facial FACS cues to compatible valence categories.

    - happy -> positive
    - neutral -> neutral
    - sad, fearful, angry, disgusted -> negative
    - surprised -> ambiguous / context-dependent (returns 'surprised')
    """
    if not dominant_face:
        return None
    df = dominant_face.lower().strip()
    if df == "happy":
        return "positive"
    if df == "neutral":
        return "neutral"
    if df in ("sad", "fearful", "angry", "disgusted", "fear"):
        return "negative"
    if df == "surprised":
        return "surprised"
    return None


class EmotionFusionService:
    """Synthesizes NLP message insights and facial expression tracking into a combined report."""

    def generate_combined_report(
        self,
        nlp_data: dict[str, Any],
        face_data: dict[str, Any] | None,
        conversation_id: str,
        session_created_at: float | None = None,
    ) -> dict[str, Any]:
        """Produce the comprehensive, multi-source emotional insights report."""
        now = time.time()
        start_ts = session_created_at or (now - nlp_data.get("period_seconds", 0.0))
        duration_sec = max(0.0, round(now - start_ts, 1))

        # 1. Source Availability Evaluation
        nlp_available = bool(nlp_data.get("available", False))
        nlp_reason = nlp_data.get("reason") if not nlp_available else None

        face_available = False
        face_reason = "Camera tracking was disabled or not enabled."
        face_summary: dict[str, Any] = {
            "available": False,
            "reason": face_reason,
            "sample_count": 0,
            "dominant_emotion": None,
            "distribution": {},
            "mean_scores": {},
            "trajectory": "No camera tracking data recorded.",
            "source": "MediaPipe-FaceLandmarker-FACS-v1",
            "limitations": "Camera tracking was inactive. No visual expression cues collected.",
        }

        if face_data:
            samples = int(face_data.get("sample_count", 0) or face_data.get("sampleCount", 0) or 0)
            is_active = bool(face_data.get("is_active", face_data.get("isActive", True)))
            last_ts = face_data.get("timestamp") or face_data.get("last_updated") or 0.0
            if last_ts > 1e11:
                last_ts = last_ts / 1000.0

            # In a check-in session summary, observations collected during the session are valid
            age = (now - last_ts) if last_ts else 0.0
            is_stale = bool(face_data.get("is_stale", False)) or (age > 20.0 and session_created_at is None) or (age > 7200.0)

            dominant = face_data.get("dominant_emotion") or face_data.get("dominantEmotion") or "neutral"
            dist = face_data.get("distribution") or face_data.get("emotions") or {}
            means = face_data.get("mean_scores") or face_data.get("meanScores") or face_data.get("emotions") or {}

            if not is_active and samples == 0:
                face_reason = "Camera tracking was disabled by the user."
            elif samples == 0:
                face_reason = "No facial observation frames were captured (0 frames recorded)."
            elif samples < 3:
                frame_label = "frame" if samples == 1 else "frames"
                face_reason = f"Insufficient observations collected ({samples} {frame_label}; minimum 3 required for stability)."
            elif is_stale:
                face_reason = f"Camera observations are stale (last recorded {int(age)} seconds ago)."
            else:
                face_available = True
                face_reason = None
                face_summary = {
                    "available": True,
                    "reason": None,
                    "sample_count": samples,
                    "dominant_emotion": dominant,
                    "distribution": dist,
                    "mean_scores": means,
                    "trajectory": face_data.get("trajectory") or f"Active facial observations across {samples} frames.",
                    "source": "MediaPipe-FaceLandmarker-FACS-v1",
                    "limitations": (
                        "On-device FACS blendshape estimates. Visual cues frequently reflect screen lighting, "
                        "reading focus, and physical posture. They do not constitute an internal emotional ground truth."
                    ),
                }

            if not face_available:
                face_summary["reason"] = face_reason
                face_summary["sample_count"] = samples
                face_summary["dominant_emotion"] = dominant if samples > 0 else None
                face_summary["distribution"] = dist
                face_summary["mean_scores"] = means


        # 2. Cross-Source Concordance / Divergence Analysis
        concordance_status = "unavailable"
        concordance_title = "Data Unavailable"
        concordance_description = "Neither text messages nor camera cues provided sufficient observations."
        divergence_explanation: str | None = None
        user_vs_model_fact_note = (
            "Clear distinction: Statements made by the student represent explicit personal self-reports. "
            "Classifier and landmarker categories represent machine-generated statistical approximations."
        )

        nlp_dominant = nlp_data.get("dominant_sentiment") if nlp_available else None
        face_dominant = face_summary.get("dominant_emotion") if face_available else None
        face_valence = map_face_to_valence(face_dominant)

        if nlp_available and face_available:
            if nlp_dominant == "positive" and face_valence == "positive":
                concordance_status = "concordant_positive"
                concordance_title = "Consistent Positive / Calm Alignment"
                concordance_description = (
                    "Both your written reflections and browser facial tracking suggest an uplifting, "
                    "hopeful, or relieved tone."
                )
            elif nlp_dominant == "neutral" and face_valence == "neutral":
                concordance_status = "concordant_neutral"
                concordance_title = "Consistent Composed / Steady Alignment"
                concordance_description = (
                    "Both written messages and camera landmark observations indicate a steady, "
                    "neutral, or attentive composure."
                )
            elif nlp_dominant == "negative" and face_valence == "negative":
                concordance_status = "concordant_negative"
                concordance_title = "Consistent Stress / Distress Alignment"
                concordance_description = (
                    "Both your written messages and facial landmark cues reflect stress, sadness, "
                    "or emotional tension."
                )
            elif face_valence == "surprised":
                concordance_status = "mixed_arousal"
                concordance_title = "Heightened Arousal with Attentive Expression"
                concordance_description = (
                    f"Your written messages showed a predominantly {nlp_dominant} tone, while facial tracking "
                    "recorded heightened visual arousal or alertness (raised brow / open eye cues)."
                )
            else:
                concordance_status = "divergent"
                concordance_title = "Divergence Between Language and Facial Cues"
                concordance_description = (
                    f"Your written reflections were categorized as predominantly '{nlp_dominant}', while facial "
                    f"tracking estimated '{face_dominant}' expression cues."
                )
                if nlp_dominant in ("positive", "neutral") and face_valence == "negative":
                    divergence_explanation = (
                        "You expressed calm, neutral, or positive words, but the camera observed furrowed brow or "
                        "frowning action units. Note that visual tension often reflects intense screen reading, "
                        "eye strain, or ambient room lighting rather than emotional distress. Your written words take precedence."
                    )
                else:
                    divergence_explanation = (
                        "You shared thoughts related to stress or burden, while the camera detected neutral or smiling cues. "
                        "Many individuals maintain polite or composed facial expressions even when feeling burdened inside. "
                        "Your typed reflections represent your true self-report."
                    )
        elif nlp_available and not face_available:
            concordance_status = "single_source_nlp"
            concordance_title = "Single-Source: Written Language Analysis"
            concordance_description = (
                f"Analysis based exclusively on {nlp_data.get('message_count', 0)} user messages. "
                f"Facial tracking was unavailable ({face_reason})."
            )
        elif not nlp_available and face_available:
            concordance_status = "single_source_face"
            concordance_title = "Single-Source: Facial Landmark Cues"
            concordance_description = (
                f"Analysis based exclusively on {face_summary.get('sample_count', 0)} facial camera frames. "
                f"Written NLP analysis was unavailable ({nlp_reason})."
            )

        # Assemble full report structure
        return {
            "session_summary": {
                "conversation_id": conversation_id,
                "generated_at": now,
                "duration_seconds": duration_sec,
                "user_messages_analyzed": nlp_data.get("message_count", 0),
                "facial_frames_analyzed": face_summary.get("sample_count", 0),
                "sources_enabled": {
                    "nlp_analysis": nlp_available,
                    "facial_analysis": face_available,
                },
                "sources_status": {
                    "nlp": "active" if nlp_available else f"unavailable ({nlp_reason})",
                    "facial": "active" if face_available else f"unavailable ({face_reason})",
                },
            },
            "nlp_insights": nlp_data,
            "facial_insights": face_summary,
            "cross_source_comparison": {
                "concordance_status": concordance_status,
                "title": concordance_title,
                "description": concordance_description,
                "divergence_explanation": divergence_explanation,
                "user_vs_model_fact_note": user_vs_model_fact_note,
            },
            "reflection_and_resources": {
                "reflection_questions": STANDARD_REFLECTION_QUESTIONS,
                "wellness_resources": WELLNESS_RESOURCES,
                "disclaimer": REPORT_DISCLAIMER,
            },
        }


_fusion_service: EmotionFusionService | None = None


def get_fusion_service() -> EmotionFusionService:
    global _fusion_service
    if _fusion_service is None:
        _fusion_service = EmotionFusionService()
    return _fusion_service
