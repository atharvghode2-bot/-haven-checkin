# Haven Check-in API: screening sessions, trends, and counselor alerts.
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import alerts, auth, sessions, students
from .store import init_store


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_store()
    yield


settings = get_settings()
app = FastAPI(
    title="Haven Check-in",
    description="AI mental wellness screening aid. Not a diagnostic tool.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(students.router)
app.include_router(alerts.router)


@app.get("/health")
async def health():
    return {"ok": True, "service": "haven-checkin"}
