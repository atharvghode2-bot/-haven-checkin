# Persistence layer: MongoDB when available, otherwise an in-memory store for local demos.
from __future__ import annotations

import logging
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any

from .config import get_settings
from .security import anonymous_code, hash_password, new_id

log = logging.getLogger("haven.store")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime | None = None) -> str:
    return (value or utcnow()).isoformat()


class MemoryStore:
    def __init__(self) -> None:
        self.users: dict[str, dict] = {}
        self.sessions: dict[str, dict] = {}
        self.responses: list[dict] = []
        self.alerts: dict[str, dict] = {}
        self.counselors: dict[str, dict] = {}
        self.by_email: dict[str, str] = {}

    async def insert_user(self, user: dict) -> dict:
        self.users[user["id"]] = user
        self.by_email[user["email"].lower()] = user["id"]
        return user

    async def find_user_by_email(self, email: str) -> dict | None:
        user_id = self.by_email.get(email.lower())
        return deepcopy(self.users.get(user_id)) if user_id else None

    async def find_user_by_id(self, user_id: str) -> dict | None:
        user = self.users.get(user_id)
        return deepcopy(user) if user else None

    async def update_user(self, user_id: str, fields: dict) -> dict | None:
        if user_id not in self.users:
            return None
        self.users[user_id].update(fields)
        return deepcopy(self.users[user_id])

    async def insert_session(self, session: dict) -> dict:
        self.sessions[session["id"]] = session
        return session

    async def find_session(self, session_id: str) -> dict | None:
        session = self.sessions.get(session_id)
        return deepcopy(session) if session else None

    async def update_session(self, session_id: str, fields: dict) -> dict | None:
        if session_id not in self.sessions:
            return None
        self.sessions[session_id].update(fields)
        return deepcopy(self.sessions[session_id])

    async def student_sessions(self, student_id: str) -> list[dict]:
        rows = [deepcopy(s) for s in self.sessions.values() if s["student_id"] == student_id]
        rows.sort(key=lambda row: row.get("created_at", ""), reverse=True)
        return rows

    async def insert_response(self, response: dict) -> dict:
        self.responses.append(deepcopy(response))
        return response

    async def session_responses(self, session_id: str) -> list[dict]:
        return [deepcopy(r) for r in self.responses if r.get("session_id") == session_id]

    async def insert_alert(self, alert: dict) -> dict:
        self.alerts[alert["id"]] = alert
        return alert

    async def find_alert(self, alert_id: str) -> dict | None:
        alert = self.alerts.get(alert_id)
        return deepcopy(alert) if alert else None

    async def update_alert(self, alert_id: str, fields: dict) -> dict | None:
        if alert_id not in self.alerts:
            return None
        self.alerts[alert_id].update(fields)
        return deepcopy(self.alerts[alert_id])

    async def list_alerts(self) -> list[dict]:
        rows = [deepcopy(a) for a in self.alerts.values()]
        rows.sort(key=lambda row: row.get("created_at", ""), reverse=True)
        return rows

    async def insert_counselor(self, counselor: dict) -> dict:
        self.counselors[counselor["counselor_id"]] = counselor
        return counselor

    async def find_counselor(self, counselor_id: str) -> dict | None:
        c = self.counselors.get(counselor_id)
        return deepcopy(c) if c else None


class MongoStore:
    def __init__(self, db) -> None:
        self.users = db.users
        self.sessions = db.sessions
        self.responses = db.responses
        self.alerts = db.alerts
        self.counselors = db.counselors

    async def insert_user(self, user: dict) -> dict:
        await self.users.insert_one(user)
        return user

    async def find_user_by_email(self, email: str) -> dict | None:
        return await self.users.find_one({"email": email.lower()}, {"_id": 0})

    async def find_user_by_id(self, user_id: str) -> dict | None:
        return await self.users.find_one({"id": user_id}, {"_id": 0})

    async def update_user(self, user_id: str, fields: dict) -> dict | None:
        await self.users.update_one({"id": user_id}, {"$set": fields})
        return await self.find_user_by_id(user_id)

    async def insert_session(self, session: dict) -> dict:
        await self.sessions.insert_one(session)
        return session

    async def find_session(self, session_id: str) -> dict | None:
        return await self.sessions.find_one({"id": session_id}, {"_id": 0})

    async def update_session(self, session_id: str, fields: dict) -> dict | None:
        await self.sessions.update_one({"id": session_id}, {"$set": fields})
        return await self.find_session(session_id)

    async def student_sessions(self, student_id: str) -> list[dict]:
        cursor = self.sessions.find({"student_id": student_id}, {"_id": 0}).sort("created_at", -1)
        return await cursor.to_list(length=200)

    async def insert_response(self, response: dict) -> dict:
        await self.responses.insert_one(response)
        return response

    async def session_responses(self, session_id: str) -> list[dict]:
        cursor = self.responses.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1)
        return await cursor.to_list(length=100)

    async def insert_alert(self, alert: dict) -> dict:
        await self.alerts.insert_one(alert)
        return alert

    async def find_alert(self, alert_id: str) -> dict | None:
        return await self.alerts.find_one({"id": alert_id}, {"_id": 0})

    async def update_alert(self, alert_id: str, fields: dict) -> dict | None:
        await self.alerts.update_one({"id": alert_id}, {"$set": fields})
        return await self.find_alert(alert_id)

    async def list_alerts(self) -> list[dict]:
        cursor = self.alerts.find({}, {"_id": 0}).sort("created_at", -1)
        return await cursor.to_list(length=500)

    async def insert_counselor(self, counselor: dict) -> dict:
        await self.counselors.insert_one(counselor)
        return counselor

    async def find_counselor(self, counselor_id: str) -> dict | None:
        return await self.counselors.find_one({"counselor_id": counselor_id}, {"_id": 0})


store: MemoryStore | MongoStore = MemoryStore()


def get_store() -> MemoryStore | MongoStore:
    return store


async def init_store() -> MemoryStore | MongoStore:
    global store
    settings = get_settings()
    if not settings.use_memory_db:
        try:
            from motor.motor_asyncio import AsyncIOMotorClient

            client = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=2500)
            await client.admin.command("ping")
            store = MongoStore(client[settings.mongo_db])
            log.info("Connected to MongoDB %s", settings.mongo_db)
        except Exception as exc:  # noqa: BLE001
            log.warning("MongoDB unavailable (%s); using in-memory store", exc)
            store = MemoryStore()
    else:
        store = MemoryStore()
        log.info("Using in-memory store (USE_MEMORY_DB=true)")

    if settings.seed_demo_data:
        await seed_demo(store)
    return store


def public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "anonymous_code": user.get("anonymous_code"),
        "consent": user.get("consent") or {},
    }


async def seed_demo(target) -> None:
    existing = await target.find_user_by_email("student@haven.edu")
    if existing:
        return

    student = {
        "id": new_id("usr_"),
        "email": "student@haven.edu",
        "name": "ayan",
        "role": "student",
        "password_hash": hash_password("Student123!"),
        "anonymous_code": "STU-4C91",
        "consent": {"camera": False, "voice": False, "data_processing": True},
        "created_at": iso(),
    }
    counselor = {
        "id": new_id("usr_"),
        "email": "counselor@haven.edu",
        "name": "Priya patil",
        "role": "counselor",
        "password_hash": hash_password("Counselor123!"),
        "anonymous_code": None,
        "consent": {},
        "created_at": iso(),
    }
    await target.insert_user(student)
    await target.insert_user(counselor)
    await target.insert_counselor(
        {
            "counselor_id": counselor["id"],
            "name": counselor["name"],
            "email": counselor["email"],
            "assigned_students": [student["anonymous_code"]],
            "created_at": iso(),
        }
    )

    for offset, fused, phq, gad, band in (
        (21, 28.0, 6, 5, "lower"),
        (14, 41.5, 10, 8, "moderate"),
        (7, 36.0, 8, 7, "moderate"),
    ):
        session_id = new_id("ses_")
        created = iso(utcnow() - timedelta(days=offset))
        await target.insert_session(
            {
                "id": session_id,
                "student_id": student["id"],
                "status": "completed",
                "index": 16,
                "answers": {},
                "consents": {"camera": False, "voice": False},
                "created_at": created,
                "completed_at": created,
                "result": {
                    "phq9": phq,
                    "gad7": gad,
                    "questionnaire_score": fused,
                    "text_sentiment_score": None,
                    "face_emotion_score": None,
                    "final_risk": fused,
                    "band": band,
                    "crisis": False,
                    "counselor_notified": band == "elevated",
                    "weights_used": {"questionnaire": 1.0},
                    "nlp_source": "skipped",
                    "disclaimer": "Screening aid only. Not a diagnosis.",
                },
            }
        )
        if band != "lower":
            await target.insert_alert(
                {
                    "id": new_id("alt_"),
                    "session_id": session_id,
                    "student_id": student["id"],
                    "anonymous_code": student["anonymous_code"],
                    "status": "resolved" if offset > 10 else "open",
                    "band": band,
                    "final_risk": fused,
                    "phq9": phq,
                    "gad7": gad,
                    "crisis": False,
                    "counselor_notified": True,
                    "notes": [],
                    "created_at": created,
                    "updated_at": created,
                }
            )
    log.info("Seeded demo student@haven.edu / counselor@haven.edu")

