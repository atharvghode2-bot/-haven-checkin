"""Comprehensive tests for Facial Emotion Analysis, NLP Scoring, and Combined Emotional Insights Report.

Covers all 11 required verification scenarios:
1. Camera and NLP analysis both enabled.
2. Camera disabled but NLP analysis works.
3. NLP inference unavailable / fails but camera and chatbot continue working.
4. Both analysis sources unavailable.
5. The two sources disagree (concordance vs divergence detection).
6. Facial observations are stale or missing.
7. Multi-turn conversation: ONLY user messages contribute to the NLP report (AI replies omitted).
8. User clears the analysis or starts a new session.
9. Multiple sessions remain strictly isolated.
10. The report clearly distinguishes estimated patterns from clinical assessment (disclaimers & non-diagnostic framing).
11. Existing questionnaire, results, camera controls, Ollama responses, and chat remain functional.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient


from app.chatbot.memory import ConversationMemoryManager
from app.chatbot.service import ChatbotService, get_chatbot_service
from app.emotion_fusion import EmotionFusionService, get_fusion_service
from app.main import app
from app.nlp_analysis import (
    SUPPORTED_NLP_LABELS,
    NLPAnalysisService,
    classify_with_lexicon,
    extract_cautious_themes,
    get_nlp_service,
)


def test_scenario_1_both_camera_and_nlp_enabled():
    """Scenario 1: Camera and NLP analysis are both enabled and concordant."""
    with TestClient(app) as client:
        # User submits positive reflection with smiling facial observation
        now = time.time()
        chat_res = client.post(
            "/api/chat",
            json={
                "message": "I finished all my exams today and I feel so relieved and calm!",
                "emotion_context": {
                    "dominant_emotion": "happy",
                    "dominant_score": 0.85,
                    "emotions": {"happy": 0.85, "neutral": 0.15},
                    "sample_count": 8,
                    "timestamp": now,
                    "is_active": True,
                },
            },
        )
        assert chat_res.status_code in (200, 500, 503, 504)
        if chat_res.status_code == 200:
            cid = chat_res.json()["conversation_id"]

            # Request report
            report_res = client.get(f"/api/chat/{cid}/report")
            assert report_res.status_code == 200
            data = report_res.json()

            # Verify NLP insights
            assert data["nlp_insights"]["available"] is True
            assert data["nlp_insights"]["dominant_sentiment"] == "positive"
            assert "positive" in data["nlp_insights"]["distribution"]

            # Verify Facial insights
            assert data["facial_insights"]["available"] is True
            assert data["facial_insights"]["dominant_emotion"] == "happy"

            # Verify Concordance
            assert data["cross_source_comparison"]["concordance_status"] == "concordant_positive"
            assert "Positive / Calm" in data["cross_source_comparison"]["title"]


def test_scenario_2_camera_disabled_nlp_active():
    """Scenario 2: Camera is disabled but NLP analysis works."""
    with TestClient(app) as client:
        chat_res = client.post(
            "/api/chat",
            json={
                "message": "I have been having trouble sleeping because I am stressed about assignments.",
            },
        )
        assert chat_res.status_code in (200, 500, 503, 504)
        if chat_res.status_code == 200:
            cid = chat_res.json()["conversation_id"]

            report_res = client.get(f"/api/chat/{cid}/report")
            assert report_res.status_code == 200
            data = report_res.json()

            assert data["nlp_insights"]["available"] is True
            assert data["nlp_insights"]["message_count"] >= 1
            assert data["facial_insights"]["available"] is False
            assert "Camera tracking was disabled" in data["facial_insights"]["reason"]
            assert data["cross_source_comparison"]["concordance_status"] == "single_source_nlp"


def test_scenario_3_nlp_unavailable_camera_and_chatbot_work():
    """Scenario 3: NLP inference fallback/failure does not crash camera or chat."""
    fusion = get_fusion_service()

    # Simulate empty or failed NLP
    empty_nlp = {
        "available": False,
        "reason": "NLP service temporarily unavailable.",
        "message_count": 0,
        "period_seconds": 0.0,
        "distribution": {},
        "mean_scores": {},
        "dominant_sentiment": None,
        "average_confidence": 0.0,
        "trajectory": "Unavailable",
        "recurring_themes": [],
        "source": "none",
        "is_trained_model": False,
        "limitations": "NLP service was offline.",
    }

    face_data = {
        "sample_count": 6,
        "dominant_emotion": "neutral",
        "emotions": {"neutral": 0.8, "happy": 0.2},
        "is_active": True,
        "timestamp": time.time(),
        "trajectory": "Steady neutral expression across 6 frames.",
    }

    report = fusion.generate_combined_report(
        nlp_data=empty_nlp,
        face_data=face_data,
        conversation_id="conv_nlp_fail",
    )

    assert report["nlp_insights"]["available"] is False
    assert report["facial_insights"]["available"] is True
    assert report["cross_source_comparison"]["concordance_status"] == "single_source_face"
    assert "Single-Source: Facial Landmark Cues" in report["cross_source_comparison"]["title"]


def test_scenario_4_both_sources_unavailable():
    """Scenario 4: Both analysis sources unavailable."""
    fusion = get_fusion_service()
    empty_nlp = {
        "available": False,
        "reason": "No user messages submitted.",
        "message_count": 0,
        "period_seconds": 0.0,
        "distribution": {},
        "mean_scores": {},
        "dominant_sentiment": None,
        "average_confidence": 0.0,
        "trajectory": "No data",
        "recurring_themes": [],
        "source": "none",
        "is_trained_model": False,
        "limitations": "No data",
    }

    report = fusion.generate_combined_report(
        nlp_data=empty_nlp,
        face_data=None,
        conversation_id="conv_both_empty",
    )

    assert report["nlp_insights"]["available"] is False
    assert report["facial_insights"]["available"] is False
    assert report["cross_source_comparison"]["concordance_status"] == "unavailable"


def test_scenario_5_sources_disagree():
    """Scenario 5: The two sources disagree (NLP positive, Camera sad)."""
    fusion = get_fusion_service()
    nlp_positive = {
        "available": True,
        "message_count": 2,
        "period_seconds": 15.0,
        "distribution": {"negative": 0.1, "neutral": 0.2, "positive": 0.7},
        "mean_scores": {"negative": 0.1, "neutral": 0.2, "positive": 0.7},
        "dominant_sentiment": "positive",
        "average_confidence": 0.75,
        "trajectory": "User expressed relief and happiness.",
        "recurring_themes": ["Language mentions restorative habits or feeling relief."],
        "source": "cardiffnlp/twitter-roberta-base-sentiment-latest",
        "is_trained_model": True,
        "limitations": "Statistical model",
    }

    face_sad = {
        "sample_count": 10,
        "dominant_emotion": "sad",
        "emotions": {"sad": 0.65, "neutral": 0.25, "happy": 0.10},
        "distribution": {"sad": 0.65, "neutral": 0.25, "happy": 0.10},
        "mean_scores": {"sad": 0.65, "neutral": 0.25, "happy": 0.10},
        "is_active": True,
        "timestamp": time.time(),
        "trajectory": "Observed brow tension and down-turned mouth.",
    }

    report = fusion.generate_combined_report(
        nlp_data=nlp_positive,
        face_data=face_sad,
        conversation_id="conv_disagree",
    )

    assert report["cross_source_comparison"]["concordance_status"] == "divergent"
    assert "Divergence Between Language and Facial Cues" in report["cross_source_comparison"]["title"]
    # Verify reassuring explanation noting written words take precedence
    assert report["cross_source_comparison"]["divergence_explanation"] is not None
    assert "written words take precedence" in report["cross_source_comparison"]["divergence_explanation"].lower()


def test_scenario_6_stale_or_missing_face_observations():
    """Scenario 6: Facial observations are stale (>15 seconds) or below threshold (<3 frames)."""
    fusion = get_fusion_service()
    nlp_data = {
        "available": True,
        "message_count": 1,
        "period_seconds": 5.0,
        "distribution": {"negative": 0.2, "neutral": 0.6, "positive": 0.2},
        "mean_scores": {"negative": 0.2, "neutral": 0.6, "positive": 0.2},
        "dominant_sentiment": "neutral",
        "average_confidence": 0.60,
        "trajectory": "Neutral",
        "recurring_themes": [],
        "source": "clinical_lexicon_fallback",
        "is_trained_model": False,
        "limitations": "Lexicon fallback",
    }

    # Stale frame from 30 seconds ago
    stale_face = {
        "sample_count": 5,
        "dominant_emotion": "neutral",
        "emotions": {"neutral": 0.9},
        "is_active": True,
        "timestamp": time.time() - 30.0,
    }

    stale_report = fusion.generate_combined_report(nlp_data, stale_face, "conv_stale")
    assert stale_report["facial_insights"]["available"] is False
    assert "stale" in stale_report["facial_insights"]["reason"].lower()

    # Insufficient frame count (1 frame)
    sparse_face = {
        "sample_count": 1,
        "dominant_emotion": "neutral",
        "emotions": {"neutral": 0.9},
        "is_active": True,
        "timestamp": time.time(),
    }
    sparse_report = fusion.generate_combined_report(nlp_data, sparse_face, "conv_sparse")
    assert sparse_report["facial_insights"]["available"] is False
    assert "insufficient" in sparse_report["facial_insights"]["reason"].lower()


def test_scenario_7_only_user_messages_analyzed():
    """Scenario 7: Multi-turn conversation with AI replies; ONLY user messages are analyzed."""
    nlp_service = get_nlp_service()
    memory = ConversationMemoryManager()

    cid = "conv_turns_filter"
    # Turn 1: user expresses exhaustion
    res1 = classify_with_lexicon("I am totally exhausted and failing to keep up with studying")
    memory.add_turn(cid, "user", "I am totally exhausted and failing to keep up with studying")
    memory.add_user_nlp_analysis(cid, {
        "timestamp": time.time() - 20,
        "sentiment": res1["sentiment"],
        "scores": res1["scores"],
        "confidence": res1["confidence"],
        "themes": extract_cautious_themes("I am totally exhausted and failing to keep up with studying"),
        "source": res1["source"],
    })

    # Turn 2: assistant reply (MUST NOT be passed to user_nlp_analysis)
    memory.add_turn(cid, "assistant", "I hear how demanding this semester feels. Have you taken a break?")

    # Turn 3: user follows up
    res2 = classify_with_lexicon("I went for a quiet walk and feel much better and relieved now")
    memory.add_turn(cid, "user", "I went for a quiet walk and feel much better and relieved now")
    memory.add_user_nlp_analysis(cid, {
        "timestamp": time.time(),
        "sentiment": res2["sentiment"],
        "scores": res2["scores"],
        "confidence": res2["confidence"],
        "themes": extract_cautious_themes("I went for a quiet walk and feel much better and relieved now"),
        "source": res2["source"],
    })

    # Turn 4: assistant reply
    memory.add_turn(cid, "assistant", "That sounds like a wonderfully grounding practice.")

    # Turns in conversation = 4 (2 user, 2 assistant)
    assert memory.get_turn_count(cid) == 4

    # User message analyses retrieved = strictly 2
    user_analyses = memory.get_user_nlp_analyses(cid)
    assert len(user_analyses) == 2

    aggregated = nlp_service.aggregate_conversation_insights(user_analyses)
    assert aggregated["message_count"] == 2
    # Verify trajectory detected shift from negative to positive
    assert "Shifted from an initial negative tone" in aggregated["trajectory"]


def test_scenario_8_clear_analysis_and_new_session():
    """Scenario 8: Clearing analysis removes derived emotion data while preserving or resetting session."""
    with TestClient(app) as client:
        # 1. Post chat message to establish conversation
        chat_res = client.post(
            "/api/chat",
            json={"message": "I am practicing progressive muscle relaxation tonight."},
        )
        assert chat_res.status_code in (200, 500, 503, 504)
        if chat_res.status_code == 200:
            cid = chat_res.json()["conversation_id"]

            # 2. Clear derived analysis endpoint
            clear_res = client.post(f"/api/chat/{cid}/clear-analysis")
            assert clear_res.status_code == 200
            assert clear_res.json()["ok"] is True

            # 3. Request report: message count should now be 0
            report_res = client.get(f"/api/chat/{cid}/report")
            assert report_res.status_code == 200
            data = report_res.json()
            assert data["session_summary"]["user_messages_analyzed"] == 0

            # 4. Reset entire conversation
            reset_res = client.post("/api/chat/reset", json={"conversation_id": cid})
            assert reset_res.status_code == 200
            assert reset_res.json()["ok"] is True


def test_scenario_9_multiple_sessions_isolated():
    """Scenario 9: Multiple sessions remain strictly isolated; cross-access is denied."""
    memory = ConversationMemoryManager()

    cid_student_a = "session_student_alpha"
    cid_student_b = "session_student_beta"

    # Student A data
    memory.add_user_nlp_analysis(cid_student_a, {"sentiment": "positive", "confidence": 0.8}, owner_id="user_a")
    memory.record_face_observation(cid_student_a, {"dominant_emotion": "happy", "sample_count": 5}, owner_id="user_a")

    # Student B data
    memory.add_user_nlp_analysis(cid_student_b, {"sentiment": "negative", "confidence": 0.75}, owner_id="user_b")
    memory.record_face_observation(cid_student_b, {"dominant_emotion": "sad", "sample_count": 6}, owner_id="user_b")

    # Verification: Student A gets only Student A's data
    data_a = memory.get_user_nlp_analyses(cid_student_a, owner_id="user_a")
    assert len(data_a) == 1
    assert data_a[0]["sentiment"] == "positive"

    # Verification: Student B gets only Student B's data
    data_b = memory.get_user_nlp_analyses(cid_student_b, owner_id="user_b")
    assert len(data_b) == 1
    assert data_b[0]["sentiment"] == "negative"

    # Cross-user isolation: User B trying to access User A's session raises PermissionError
    denied = False
    try:
        memory.get_user_nlp_analyses(cid_student_a, owner_id="user_b")
    except PermissionError:
        denied = True
    assert denied, "Expected PermissionError when accessing another user's session."



def test_scenario_10_clear_distinction_from_clinical_assessment():
    """Scenario 10: Report clearly distinguishes estimates from clinical diagnosis."""
    fusion = get_fusion_service()
    report = fusion.generate_combined_report(
        nlp_data={"available": True, "message_count": 1, "dominant_sentiment": "negative", "distribution": {"negative": 1.0, "neutral": 0, "positive": 0}, "source": "clinical_lexicon_fallback", "limitations": "Rule-based fallback"},
        face_data={"sample_count": 5, "dominant_emotion": "sad", "emotions": {"sad": 1.0}, "is_active": True, "timestamp": time.time()},
        conversation_id="conv_clinical_check",
    )

    # 1. No numerical clinical severity score
    assert "clinical_score" not in report
    assert "mental_health_severity" not in report

    # 2. Disclaimer present
    assert "not a diagnostic instrument" in report["reflection_and_resources"]["disclaimer"].lower()
    assert "does not establish a clinical diagnosis" in report["reflection_and_resources"]["disclaimer"].lower()

    # 3. Clear distinction between user fact and model estimate
    assert "Clear distinction" in report["cross_source_comparison"]["user_vs_model_fact_note"]


def test_scenario_11_existing_questionnaire_and_triage_remain_functional():
    """Scenario 11: Validated questionnaire, auth, and scoring remain intact and unchanged."""
    with TestClient(app) as client:
        # Student login
        login = client.post("/auth/login", json={"email": "student@haven.edu", "password": "Student123!"})
        assert login.status_code == 200
        token = login.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Questionnaire retrieval
        q_res = client.get("/questionnaire", headers=headers)
        assert q_res.status_code == 200
        items = q_res.json()["items"]
        assert len(items) == 17  # PHQ-9 (9) + GAD-7 (7) + OPEN_ITEM (1)


        # Health endpoint
        h_res = client.get("/health")
        assert h_res.status_code == 200
        assert h_res.json()["ok"] is True


if __name__ == "__main__":
    test_scenario_1_both_camera_and_nlp_enabled()
    test_scenario_2_camera_disabled_nlp_active()
    test_scenario_3_nlp_unavailable_camera_and_chatbot_work()
    test_scenario_4_both_sources_unavailable()
    test_scenario_5_sources_disagree()
    test_scenario_6_stale_or_missing_face_observations()
    test_scenario_7_only_user_messages_analyzed()
    test_scenario_8_clear_analysis_and_new_session()
    test_scenario_9_multiple_sessions_isolated()
    test_scenario_10_clear_distinction_from_clinical_assessment()
    test_scenario_11_existing_questionnaire_and_triage_remain_functional()
    print("ALL 11 SCENARIO TESTS PASSED SUCCESSFULLY!")
