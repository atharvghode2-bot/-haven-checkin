# Counselor-only alerts, filtering, status updates, and protected notes.
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..deps import require_role
from ..schemas import AlertNoteIn, AlertStatusIn
from ..security import new_id
from ..store import get_store, iso

router = APIRouter(tags=["alerts"])


def visible_alert(alert: dict, include_notes: bool = False) -> dict:
    payload = {
        "id": alert["id"],
        "session_id": alert["session_id"],
        "anonymous_code": alert.get("anonymous_code"),
        "student_id": alert["student_id"],
        "status": alert["status"],
        "band": alert["band"],
        "final_risk": alert["final_risk"],
        "phq9": alert.get("phq9"),
        "gad7": alert.get("gad7"),
        "crisis": alert.get("crisis", False),
        "counselor_notified": alert.get("counselor_notified", False),
        "created_at": alert["created_at"],
        "updated_at": alert.get("updated_at"),
        "note_count": len(alert.get("notes") or []),
    }
    if include_notes:
        payload["notes"] = alert.get("notes") or []
    return payload


@router.get("/alerts")
async def list_alerts(
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = None,
    sort: str = "newest",
    _: dict = Depends(require_role("counselor")),
):
    rows = await get_store().list_alerts()
    if status_filter:
        rows = [row for row in rows if row["status"] == status_filter]
    if q:
        needle = q.lower().strip()
        rows = [
            row
            for row in rows
            if needle in (row.get("anonymous_code") or "").lower()
            or needle in (row.get("band") or "")
            or needle in (row.get("status") or "")
        ]
    reverse = sort != "oldest"
    if sort in ("risk", "risk_desc"):
        rows.sort(key=lambda row: float(row.get("final_risk") or 0), reverse=True)
    else:
        rows.sort(key=lambda row: row.get("created_at", ""), reverse=reverse)

    open_count = sum(1 for row in await get_store().list_alerts() if row["status"] in ("open", "acknowledged", "in_review"))
    crisis_count = sum(1 for row in await get_store().list_alerts() if row.get("crisis") and row["status"] != "resolved")
    return {
        "alerts": [visible_alert(row) for row in rows],
        "overview": {
            "open": open_count,
            "crisis_open": crisis_count,
            "total": len(await get_store().list_alerts()),
        },
    }


@router.get("/alerts/{alert_id}")
async def get_alert(alert_id: str, _: dict = Depends(require_role("counselor"))):
    alert = await get_store().find_alert(alert_id)
    if not alert:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found.")
    return {"alert": visible_alert(alert, include_notes=True)}


@router.patch("/alerts/{alert_id}")
async def update_alert_status(
    alert_id: str,
    body: AlertStatusIn,
    _: dict = Depends(require_role("counselor")),
):
    alert = await get_store().find_alert(alert_id)
    if not alert:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found.")
    updated = await get_store().update_alert(alert_id, {"status": body.status, "updated_at": iso()})
    return {"alert": visible_alert(updated or alert, include_notes=True)}


@router.post("/alerts/{alert_id}/notes")
async def add_note(
    alert_id: str,
    body: AlertNoteIn,
    user: dict = Depends(require_role("counselor")),
):
    alert = await get_store().find_alert(alert_id)
    if not alert:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found.")
    notes = list(alert.get("notes") or [])
    notes.append(
        {
            "id": new_id("nte_"),
            "author_id": user["id"],
            "author_name": user["name"],
            "body": body.body.strip(),
            "created_at": iso(),
        }
    )
    updated = await get_store().update_alert(alert_id, {"notes": notes, "updated_at": iso()})
    return {"alert": visible_alert(updated or alert, include_notes=True)}
