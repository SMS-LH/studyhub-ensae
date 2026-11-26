import asyncio
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from pymongo import ReturnDocument

from core import (
    create_token,
    db,
    format_ensae_level,
    get_current_user,
    hash_password,
    new_id,
    normalize_ensae_level,
    now_iso,
    public_user,
    verify_password,
)

router = APIRouter(prefix="/api/auth")


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    university: str = "ENSAE"
    filiere: str = ""
    annee: int | None = None
    class_code: str = ""
    is_parallel_admission: bool = False
    is_tutor: bool = False
    tutor_subjects: list[str] = []
    weaknesses: list[str] = []
    contact_info: str = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def _issue(response: Response, user: dict) -> dict:
    return {
        "user": public_user(user),
        "token": create_token(user["id"], "access", timedelta(days=7)),
    }


@router.post("/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Un compte existe déjà avec cet email")
    filiere, annee = normalize_ensae_level(body.filiere, body.annee)
    level_label = format_ensae_level(filiere, annee)
    tutor_subjects = [s.strip() for s in body.tutor_subjects if s.strip()]
    weaknesses = [w.strip() for w in body.weaknesses if w.strip()]
    is_first_user = await db.users.count_documents({}) == 0
    is_ensae_email = email.endswith("@ensae.fr") or email.endswith("@ensae.sn")
    code = body.class_code.strip().upper()
    promo_ws = None
    if filiere and annee:
        promo_ws = await db.workspaces.find_one(
            {"type": "promo", "filiere": filiere, "annee": annee}, {"_id": 0}
        )
    valid_class_code = bool(
        code and promo_ws and code == (promo_ws.get("invite_code") or "").upper()
    )
    role = "moderator" if is_first_user else "student"
    is_verified = True if (is_first_user or is_ensae_email or valid_class_code) else False
    user = {
        "id": new_id(),
        "email": email,
        "name": body.name.strip(),
        "university": body.university.strip() or "ENSAE",
        "filiere": filiere,
        "annee": annee,
        "field": filiere,
        "year": level_label,
        "is_parallel_admission": bool(body.is_parallel_admission),
        "is_tutor": bool(body.is_tutor),
        "tutor_subjects": tutor_subjects if body.is_tutor else [],
        "tutor_slots": [],
        "contact_info": body.contact_info.strip(),
        "tutor_available_this_week": True,
        "weaknesses": weaknesses,
        "role": role,
        "is_verified": is_verified,
        "verification_status": "verified" if is_verified else "pending",
        "password_hash": await asyncio.to_thread(hash_password, body.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(dict(user))
    if promo_ws:
        await db.workspaces.update_one(
            {"id": promo_ws["id"]},
            {"$addToSet": {"members": {"id": user["id"], "name": user["name"]}}},
        )
    return _issue(response, user)


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    now = datetime.now(timezone.utc)
    attempt = await db.login_attempts.find_one({"identifier": email})
    if attempt and datetime.fromisoformat(attempt["window_until"]) <= now:
        await db.login_attempts.delete_one({"identifier": email})
        attempt = None
    if attempt and attempt.get("count", 0) >= 5:
        raise HTTPException(429, "Trop de tentatives. Réessaie dans 15 minutes.")
    reserved = await db.login_attempts.find_one_and_update(
        {"identifier": email},
        {
            "$inc": {"count": 1},
            "$setOnInsert": {"window_until": (now + timedelta(minutes=15)).isoformat()},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if reserved["count"] > 5:
        raise HTTPException(429, "Trop de tentatives. Réessaie dans 15 minutes.")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not await asyncio.to_thread(
        verify_password, body.password, user["password_hash"]
    ):
        raise HTTPException(401, "Email ou mot de passe incorrect")
    await db.login_attempts.delete_one({"identifier": email})
    return _issue(response, user)


@router.post("/logout")
async def logout():
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@router.get("/users")
async def list_users(
    filiere: str = "",
    annee: int | None = None,
    is_tutor: bool | None = None,
    subject: str = "",
    q: str = "",
    user: dict = Depends(get_current_user),
):
    flt: dict = {"role": {"$ne": "admin"}}
    if filiere:
        flt["filiere"] = filiere.strip().upper()
    if annee is not None:
        flt["annee"] = annee
    if is_tutor is not None:
        flt["is_tutor"] = is_tutor
    if subject:
        flt["tutor_subjects"] = subject
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        flt["$or"] = [
            {"name": rx},
            {"bio": rx},
            {"tutor_subjects": rx},
            {"skills.name": rx},
        ]
    users = await db.users.find(flt, {"_id": 0, "password_hash": 0}).to_list(500)
    return [public_user(u) for u in users]
