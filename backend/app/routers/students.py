# Student trend summaries. Students may only read their own records.
from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import get_current_user
from ..store import get_store

router = APIRouter(tags=["students"])


def summary_from_session(session: dict) -> dict | None:
    result = session.get("result")
    if session.get("status") != "completed" or not result:
        return None
    return {
        "session_id": session["id"],
        "completed_at": session.get("completed_at") or session.get("created_at"),
        "phq9": result.get("phq9"),
        "gad7": result.get("gad7"),
        "final_risk": result.get("final_risk"),
        "band": result.get("band"),
        "crisis": result.get("crisis"),
    }


@router.get("/students/{student_id}/trends")
async def student_trends(student_id: str, user: dict = Depends(get_current_user)):
    if user["role"] == "student" and user["id"] != student_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only view your own check-in history.")
    if user["role"] not in ("student", "counselor"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this area.")

    target = await get_store().find_user_by_id(student_id)
    if not target or target["role"] != "student":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")

    sessions = await get_store().student_sessions(student_id)
    points = [row for row in (summary_from_session(item) for item in sessions) if row]
    points.sort(key=lambda row: row["completed_at"])
    return {
        "student_id": student_id if user["role"] == "counselor" else user["id"],
        "anonymous_code": target.get("anonymous_code") if user["role"] == "counselor" else None,
        "points": points,
        "latest": points[-1] if points else None,
    }


@router.get("/students/me/history")
async def my_history(user: dict = Depends(get_current_user)):
    if user["role"] != "student":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Student history is only available on student accounts.")
    sessions = await get_store().student_sessions(user["id"])
    points = [row for row in (summary_from_session(item) for item in sessions) if row]
    return {"points": points}


@router.get("/students/me/sessions")
async def my_sessions(user: dict = Depends(get_current_user)):
    if user["role"] != "student":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Student sessions are only available on student accounts.")
    sessions = await get_store().student_sessions(user["id"])
    return {
        "sessions": [
            {
                "id": s["id"],
                "created_at": s.get("created_at"),
                "completed_at": s.get("completed_at"),
                "status": s.get("status"),
                "result": s.get("result"),
            }
            for s in sessions
        ]
    }
