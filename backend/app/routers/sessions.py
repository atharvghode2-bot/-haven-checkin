import asyncio
from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import require_role
from ..nlp import face_emotion_score, text_sentiment_score
from ..questionnaire import LIKERT_OPTIONS, all_items
from ..schemas import AnswerIn, FinishIn, SessionStartIn
from ..scoring import (
    CRISIS_RESOURCES,
    crisis_from_phq9,
    crisis_from_text,
    fuse_scores,
    gad7_total,
    phq9_total,
    questionnaire_score_100,
    sanitize_open_text,
    self_help_for,
    should_notify_counselor,
    band_for,
)
from ..security import new_id
from ..store import get_store, iso

router = APIRouter(tags=["sessions"])
DISCLAIMER = (
    "This check-in is a screening aid, not a diagnosis. Scores do not confirm a mental health "
    "condition and cannot replace a licensed clinician."
)

FEEDBACK_MESSAGES: dict[str, str] = {
    "phq9_1": "Thank you for sharing that. Let's look at mood and feelings next.",
    "phq9_2": "I hear you. Take your time with this next question.",
    "phq9_3": "Sleep is a vital piece of the picture. Moving to daily energy levels...",
    "phq9_4": "Noted. Next, let's see how your appetite or eating patterns have been.",
    "phq9_5": "Thank you. Let's reflect on how you've been feeling about yourself.",
    "phq9_6": "I appreciate your openness. Next is about focus and concentration.",
    "phq9_7": "Thank you. Let's check how restless or slowed down you might feel.",
    "phq9_8": "Almost done with this part. The next question touches on personal safety.",
    "phq9_9": "Thank you for answering honestly. Next, we'll look at anxiety and worry.",
    "gad7_1": "Thank you. Let's see how much control you've felt over recurring worries.",
    "gad7_2": "Understood. Let's check how broad or frequent worries have felt.",
    "gad7_3": "Got it. Moving on to how easily you've been able to relax lately.",
    "gad7_4": "Thank you. Let's see if physical restlessness has been a factor.",
    "gad7_5": "Noted. Next is about feeling irritable or easily annoyed.",
    "gad7_6": "Almost at the end of the structured screening.",
    "gad7_7": "Thank you. Lastly, an optional open space to express anything on your mind.",
    "open_1": "Thank you for trusting Haven with your reflections.",
}


def serialize_item(item: dict, index: int, total: int) -> dict:
    payload = {
        "id": item["id"],
        "prompt": item["prompt"],
        "instrument": item["instrument"],
        "optional": bool(item.get("optional")),
        "index": index,
        "total": total,
        "kind": "text" if item["instrument"] == "open" else "likert",
    }
    if payload["kind"] == "likert":
        payload["options"] = LIKERT_OPTIONS
    return payload


@router.get("/questionnaire")
async def questionnaire(_: dict = Depends(require_role("student", "counselor"))):
    items = all_items()
    return {"items": [serialize_item(item, i, len(items)) for i, item in enumerate(items)], "disclaimer": DISCLAIMER}


@router.post("/sessions")
async def create_session(body: SessionStartIn, user: dict = Depends(require_role("student"))):
    session = {
        "id": new_id("ses_"),
        "student_id": user["id"],
        "status": "active",
        "index": 0,
        "answers": {},
        "consents": {"camera": body.camera_consent, "voice": body.voice_consent},
        "created_at": iso(),
        "completed_at": None,
        "result": None,
        "finish_key": None,
    }
    await get_store().insert_session(session)
    items = all_items()
    return {
        "session_id": session["id"],
        "item": serialize_item(items[0], 0, len(items)),
        "consents": session["consents"],
    }


@router.post("/sessions/{session_id}/answer")
async def answer_item(session_id: str, body: AnswerIn, user: dict = Depends(require_role("student"))):
    session = await get_store().find_session(session_id)
    if not session or session["student_id"] != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found.")
    if session["status"] != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "This check-in is already complete.")

    items = all_items()
    current = items[session["index"]]
    if body.item_id != current["id"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Answer the current question before continuing.")

    answers = dict(session["answers"])
    if current["instrument"] == "open":
        answers[current["id"]] = sanitize_open_text(body.text)
    else:
        try:
            value = int(body.value)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose one of the listed options.") from exc
        if value not in (0, 1, 2, 3):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose one of the listed options.")
        answers[current["id"]] = value

    next_index = session["index"] + 1
    await get_store().update_session(session_id, {"answers": answers, "index": next_index})
    
    # Store individual response record in responses collection/store
    await get_store().insert_response({
        "id": new_id("res_"),
        "session_id": session_id,
        "question_id": current["id"],
        "instrument": current["instrument"],
        "answer_value": body.value if current["instrument"] != "open" else None,
        "answer_text": body.text if current["instrument"] == "open" else None,
        "created_at": iso(),
    })
    
    done = next_index >= len(items)
    next_item = None if done else serialize_item(items[next_index], next_index, len(items))

    # Provide empathetic reflection via local Ollama if student shared open text
    acknowledgement = FEEDBACK_MESSAGES.get(current["id"], "Thank you for sharing.")
    if current["instrument"] == "open" and body.text and body.text.strip():
        try:
            from ..chatbot.service import get_chatbot_service
            service = get_chatbot_service()
            prompt = (
                f"A university student just shared this reflection in their wellness check-in: \"{body.text.strip()[:300]}\". "
                "Write a warm, supportive 1-2 sentence peer acknowledgement validating their thoughts. "
                "Do not diagnose, lecture, or advise medication. Keep it under 30 words."
            )
            reply = await asyncio.wait_for(
                service.llm.chat([
                    {"role": "system", "content": "You are Haven, a compassionate student wellness companion."},
                    {"role": "user", "content": prompt}
                ], max_tokens=60),
                timeout=3.5,
            )
            if reply and len(reply.strip()) > 5:
                acknowledgement = reply.strip()
        except Exception:
            pass

    return {
        "done": done,
        "item": next_item,
        "acknowledgement": acknowledgement,
        "progress": {"current": next_index, "total": len(items)},
    }


@router.post("/sessions/{session_id}/back")
async def go_back(session_id: str, user: dict = Depends(require_role("student"))):
    session = await get_store().find_session(session_id)
    if not session or session["student_id"] != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found.")
    if session["status"] != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "This check-in is already complete.")
    index = max(0, int(session["index"]) - 1)
    await get_store().update_session(session_id, {"index": index})
    items = all_items()
    return {"item": serialize_item(items[index], index, len(items))}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, user: dict = Depends(require_role("student"))):
    session = await get_store().find_session(session_id)
    if not session or session["student_id"] != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found.")
    return {
        "session_id": session["id"],
        "status": session["status"],
        "result": session.get("result"),
        "consents": session.get("consents"),
    }


VALID_EMOTION_KEYS = {"neutral", "happy", "sad", "angry", "fearful", "surprised", "disgusted"}


def validate_face_emotions(emotions: dict[str, float] | None, sample_count: int | None) -> dict[str, float] | None:
    """Validate client-supplied emotion predictions: verify categories, range [0, 1], and sample depth."""
    if not emotions or not isinstance(emotions, dict):
        return None
    if sample_count is not None and sample_count < 3:
        # Insufficient sample depth across frames to form a reliable statistical signal
        return None
    validated: dict[str, float] = {}
    for key, val in emotions.items():
        clean_key = str(key).lower().strip()
        if clean_key not in VALID_EMOTION_KEYS:
            continue
        try:
            num = float(val)
            if 0.0 <= num <= 1.0:
                validated[clean_key] = round(num, 4)
        except (ValueError, TypeError):
            continue
    return validated if validated else None


@router.post("/sessions/{session_id}/finish")
async def finish_session(session_id: str, body: FinishIn, user: dict = Depends(require_role("student"))):
    session = await get_store().find_session(session_id)
    if not session or session["student_id"] != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found.")
    if session["status"] == "completed" and session.get("result"):
        return {"result": session["result"], "duplicate": True}

    items = all_items()
    required = [item["id"] for item in items if not item.get("optional")]
    missing = [item_id for item_id in required if item_id not in session["answers"]]
    if missing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please complete the remaining questions before submitting.")

    if body.idempotency_key and session.get("finish_key") == body.idempotency_key and session.get("result"):
        return {"result": session["result"], "duplicate": True}

    answers = session["answers"]
    phq = phq9_total(answers)
    gad = gad7_total(answers)
    q_score = questionnaire_score_100(phq, gad)
    open_text = sanitize_open_text(answers.get("open_1") if isinstance(answers.get("open_1"), str) else None)
    text_score, nlp_source = await text_sentiment_score(open_text)

    # Validate camera consent and client-side emotion scores
    camera_consented = bool(session.get("consents", {}).get("camera"))
    validated_emotions = validate_face_emotions(body.face_emotions, body.face_sample_count) if camera_consented else None
    face_used = camera_consented and validated_emotions is not None
    face_score = face_emotion_score(validated_emotions) if face_used else None

    fused, weights = fuse_scores(q_score, text_score, face_score, face_used)
    crisis = crisis_from_phq9(answers) or crisis_from_text(open_text)
    band = band_for(fused, crisis)
    notify = should_notify_counselor(
        fused=fused,
        questionnaire=q_score,
        crisis=crisis,
        face_used=face_used,
    )

    counselor_notified = False
    if notify:
        alert = {
            "id": new_id("alt_"),
            "session_id": session_id,
            "student_id": user["id"],
            "anonymous_code": user.get("anonymous_code"),
            "status": "open",
            "band": band,
            "final_risk": fused,
            "phq9": phq,
            "gad7": gad,
            "crisis": crisis,
            "counselor_notified": True,
            "notes": [],
            "created_at": iso(),
            "updated_at": iso(),
        }
        await get_store().insert_alert(alert)
        counselor_notified = True

    result = {
        "phq9": phq,
        "gad7": gad,
        "questionnaire_score": q_score,
        "text_sentiment_score": text_score,
        "face_emotion_score": face_score,
        "face_emotions_breakdown": validated_emotions,
        "face_sample_count": body.face_sample_count if face_used else None,
        "final_risk": fused,
        "band": band,
        "crisis": crisis,
        "counselor_notified": counselor_notified,
        "weights_used": weights,
        "nlp_source": nlp_source,
        "recommendations": self_help_for(band),
        "crisis_resources": CRISIS_RESOURCES,
        "disclaimer": DISCLAIMER,
        "completed_at": iso(),
    }
    await get_store().update_session(
        session_id,
        {
            "status": "completed",
            "completed_at": result["completed_at"],
            "result": result,
            "face_emotions": validated_emotions,
            "face_sample_count": body.face_sample_count if face_used else None,
            "face_model": body.face_model_version if face_used else None,
            "finish_key": body.idempotency_key,
            "index": len(items),
        },
    )
    return {"result": result, "duplicate": False}
