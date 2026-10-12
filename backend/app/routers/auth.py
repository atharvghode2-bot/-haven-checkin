# Authentication, profile, and consent endpoints.
from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import get_current_user
from ..schemas import ConsentIn, LoginIn, RegisterIn
from ..security import anonymous_code, create_access_token, hash_password, new_id, verify_password
from ..store import get_store, iso, public_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register(body: RegisterIn):
    if await get_store().find_user_by_email(body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with that email already exists.")
    if body.role == "counselor" and not body.email.endswith("@haven.edu"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Counselor accounts are limited to verified campus emails in this demo.",
        )
    user = {
        "id": new_id("usr_"),
        "email": body.email.lower(),
        "name": body.name.strip(),
        "role": body.role,
        "password_hash": hash_password(body.password),
        "anonymous_code": anonymous_code() if body.role == "student" else None,
        "consent": {"camera": False, "voice": False, "data_processing": True},
        "created_at": iso(),
    }
    await get_store().insert_user(user)
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    return {"token": token, "user": public_user(user)}


@router.post("/login")
async def login(body: LoginIn):
    user = await get_store().find_user_by_email(body.email)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect.")
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    return {"token": token, "user": public_user(user)}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": public_user(user)}


@router.post("/consent")
async def update_consent(body: ConsentIn, user: dict = Depends(get_current_user)):
    updated = await get_store().update_user(user["id"], {"consent": body.model_dump()})
    return {"user": public_user(updated or user)}
