import asyncio
import hashlib
import os
import re
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import parseaddr

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from pymongo import ReturnDocument

from core import (
    create_token,
    db,
    format_ensae_level,
    get_current_user,
    hash_password,
    logger,
    new_id,
    normalize_class,
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
    class_name: str = ""          # e.g. "ISE1 Math", "AS2"
    # Legacy fields kept for compat
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


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=6)


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def _send_reset_email(to_email: str, name: str, reset_url: str) -> None:
    subject = "StudyHub ENSAE — Réinitialisation de ton mot de passe"
    text_body = (
        f"Bonjour {name},\n\n"
        f"Tu as demandé la réinitialisation de ton mot de passe sur StudyHub ENSAE.\n"
        f"Clique sur le lien ci-dessous (valable 1 heure) :\n\n"
        f"{reset_url}\n\n"
        f"Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.\n\n"
        f"— L'équipe StudyHub ENSAE"
    )
    html_body = (
        f'<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">'
        f'<h2 style="color:#1e3a8a;margin-bottom:8px">StudyHub ENSAE</h2>'
        f"<p>Bonjour <strong>{name}</strong>,</p>"
        f"<p>Tu as demandé à réinitialiser ton mot de passe. Ce lien est valable <strong>1 heure</strong> :</p>"
        f'<p style="margin:24px 0">'
        f'<a href="{reset_url}" style="background:#1e3a8a;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">'
        f"Réinitialiser mon mot de passe</a></p>"
        f'<p style="font-size:12px;color:#64748b">Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :<br/>{reset_url}</p>'
        f'<p style="font-size:12px;color:#64748b">Si tu n\'es pas à l\'origine de cette demande, ignore cet email.</p>'
        f"</div>"
    )

    smtp_user = os.environ.get("SMTP_USER", "").strip()
    smtp_from = os.environ.get("SMTP_FROM", "").strip().strip("\"'") or smtp_user or "no-reply@studyhub-ensae.fr"
    from_name, from_email = parseaddr(smtp_from)
    if not from_email and "@" in smtp_from and " " not in smtp_from:
        from_email = smtp_from
    if not from_email:
        from_name, from_email = "StudyHub ENSAE", "no-reply@studyhub-ensae.fr"

    brevo_key = os.environ.get("BREVO_API_KEY", "").strip()
    if brevo_key:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    "https://api.brevo.com/v3/smtp/email",
                    headers={"api-key": brevo_key, "Content-Type": "application/json"},
                    json={
                        "sender": {"name": from_name or "StudyHub ENSAE", "email": from_email},
                        "to": [{"email": to_email, "name": name}],
                        "subject": subject,
                        "htmlContent": html_body,
                        "textContent": text_body,
                    },
                )
            if r.status_code >= 400:
                logger.error("Brevo API error %s: %s", r.status_code, r.text)
                try:
                    brevo_msg = r.json().get("message", "")
                except Exception:
                    brevo_msg = ""
                raise HTTPException(
                    502,
                    f"Impossible d'envoyer l'email via Brevo ({r.status_code}{': ' + brevo_msg if brevo_msg else ''}).",
                )
            return
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Brevo API request failed: %s", exc)
            raise HTTPException(502, "Impossible d'envoyer l'email pour le moment. Réessaie plus tard.")

    resend_key = os.environ.get("RESEND_API_KEY", "").strip()
    if resend_key:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
                    json={
                        "from": smtp_from,
                        "to": [to_email],
                        "subject": subject,
                        "html": html_body,
                        "text": text_body,
                    },
                )
            if r.status_code >= 400:
                logger.error("Resend API error %s: %s", r.status_code, r.text)
                raise HTTPException(502, "Impossible d'envoyer l'email via Resend.")
            return
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Resend API request failed: %s", exc)
            raise HTTPException(502, "Impossible d'envoyer l'email pour le moment. Réessaie plus tard.")

    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    smtp_port = int(os.environ.get("SMTP_PORT", "587").strip() or "587")
    smtp_pass = os.environ.get("SMTP_PASSWORD", "").strip()

    if not smtp_host or not smtp_user or not smtp_pass:
        logger.warning(
            "Email non configuré — lien de réinitialisation pour %s : %s",
            to_email,
            reset_url,
        )
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    def _smtp_send() -> None:
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=8) as server:
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=8) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)

    try:
        await asyncio.to_thread(_smtp_send)
    except Exception as exc:
        logger.error("Erreur envoi email reset à %s : %s", to_email, exc)
        raise HTTPException(
            502,
            "Envoi SMTP bloqué ou indisponible sur le serveur. Configure BREVO_API_KEY (HTTPS) sur Render.",
        )


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

    # Resolve class_name: prefer new field, fall back to legacy filiere+annee
    from core import ENSAE_CLASSES
    class_name = normalize_class(body.class_name) if body.class_name.strip() else ""
    if not class_name and body.filiere:
        # Legacy path: build from filiere+annee
        filiere_l, annee_l = normalize_ensae_level(body.filiere, body.annee)
        if filiere_l and annee_l:
            class_name = format_ensae_level(filiere_l, annee_l)

    tutor_subjects = [s.strip() for s in body.tutor_subjects if s.strip()]
    weaknesses = [w.strip() for w in body.weaknesses if w.strip()]
    is_first_user = await db.users.count_documents({}) == 0
    is_ensae_email = email.endswith("@ensae.fr") or email.endswith("@ensae.sn")

    code = body.class_code.strip().upper()
    promo_ws = None
    if class_name:
        promo_ws = await db.workspaces.find_one(
            {"type": "promo", "class_name": class_name}, {"_id": 0}
        )
        if not promo_ws:
            # Legacy lookup
            promo_ws = await db.workspaces.find_one(
                {"type": "promo", "class_label": class_name}, {"_id": 0}
            )
    valid_class_code = bool(
        code and promo_ws and code == (promo_ws.get("invite_code") or "").upper()
    )
    role = "moderator" if is_first_user else "student"
    is_verified = bool(is_first_user or is_ensae_email or valid_class_code)
    user = {
        "id": new_id(),
        "email": email,
        "name": body.name.strip(),
        "university": body.university.strip() or "ENSAE",
        "class_name": class_name,
        "is_parallel_admission": bool(body.is_parallel_admission),
        "is_tutor": bool(body.is_tutor),
        "tutor_subjects": tutor_subjects if body.is_tutor else [],
        "tutor_slots": [],
        "contact_info": body.contact_info.strip(),
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


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0, "id": 1, "name": 1, "email": 1})
    if user:
        raw_token = secrets.token_urlsafe(32)
        token_hash = _hash_reset_token(raw_token)
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        await db.password_reset_tokens.delete_many({"email": email})
        await db.password_reset_tokens.insert_one(
            {
                "id": new_id(),
                "token_hash": token_hash,
                "user_id": user["id"],
                "email": email,
                "expires_at": expires_at,
                "used": False,
                "created_at": now_iso(),
            }
        )
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000").strip().rstrip("/")
        reset_url = f"{frontend_url}/connexion?reset_token={raw_token}"
        await _send_reset_email(email, user.get("name", "étudiant"), reset_url)
    return {
        "ok": True,
        "message": "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
    }


@router.post("/reset-password")
async def reset_password(body: ResetPasswordIn):
    token_hash = _hash_reset_token(body.token.strip())
    record = await db.password_reset_tokens.find_one(
        {"token_hash": token_hash, "used": False}, {"_id": 0}
    )
    if not record:
        raise HTTPException(400, "Lien invalide ou déjà utilisé.")
    if datetime.fromisoformat(record["expires_at"]) <= datetime.now(timezone.utc):
        await db.password_reset_tokens.delete_one({"token_hash": token_hash})
        raise HTTPException(400, "Lien expiré. Refais une demande de réinitialisation.")

    new_hash = await asyncio.to_thread(hash_password, body.new_password)
    await db.users.update_one(
        {"id": record["user_id"]},
        {"$set": {"password_hash": new_hash}},
    )
    await db.password_reset_tokens.update_one(
        {"token_hash": token_hash},
        {"$set": {"used": True}},
    )
    await db.login_attempts.delete_one({"identifier": record["email"]})
    return {"ok": True, "message": "Mot de passe mis à jour ! Tu peux te connecter."}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@router.get("/users")
async def list_users(
    class_name: str = "",
    filiere: str = "",
    annee: int | None = None,
    is_tutor: bool | None = None,
    subject: str = "",
    q: str = "",
    user: dict = Depends(get_current_user),
):
    flt: dict = {"role": {"$ne": "admin"}}
    if class_name:
        flt["class_name"] = class_name.strip()
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
