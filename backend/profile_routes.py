from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from core import (
    APP_NAME,
    db,
    format_ensae_level,
    get_current_user,
    get_object,
    logger,
    new_id,
    normalize_class,
    normalize_ensae_level,
    now_iso,
    public_user,
    put_object,
)
from gamification import compute_stats

router = APIRouter(prefix="/api")
IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


class Skill(BaseModel):
    name: str = Field(max_length=60)
    level: str = Field(default="", max_length=40)


class ProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    university: str = Field(default="ENSAE", max_length=120)
    class_name: str = Field(default="", max_length=40)
    field: str = Field(default="", max_length=80)
    year: str = Field(default="", max_length=30)
    filiere: str = Field(default="", max_length=10)
    annee: int | None = None
    is_parallel_admission: bool = False
    is_tutor: bool = False
    tutor_subjects: list[str] = Field(default=[], max_length=20)
    tutor_slots: list[str] = Field(default=[], max_length=20)
    contact_info: str = Field(default="", max_length=160)
    weaknesses: list[str] = Field(default=[], max_length=20)
    bio: str = Field(default="", max_length=600)
    interests: list[str] = Field(default=[], max_length=20)
    skills: list[Skill] = Field(default=[], max_length=30)


@router.put("/users/me")
async def update_profile(body: ProfileIn, user: dict = Depends(get_current_user)):
    data = body.model_dump()
    data["name"] = data["name"].strip()
    if not data["name"]:
        raise HTTPException(400, "Le nom est obligatoire")
    cn = normalize_class(data.get("class_name")) if data.get("class_name", "").strip() else ""
    if cn:
        data["class_name"] = cn
        data["year"] = cn
    else:
        filiere, annee = normalize_ensae_level(
            data.get("filiere") or data.get("field"), data.get("annee")
        )
        data["filiere"] = filiere
        data["annee"] = annee
        if filiere:
            data["field"] = filiere
        if filiere and annee:
            data["year"] = format_ensae_level(filiere, annee)
            data["class_name"] = data["year"]
    data["university"] = (data.get("university") or "ENSAE").strip()
    data["is_parallel_admission"] = bool(data.get("is_parallel_admission", False))
    data["interests"] = [i.strip() for i in data["interests"] if i.strip()]
    data["weaknesses"] = [w.strip() for w in data.get("weaknesses", []) if w.strip()]
    data["skills"] = [s for s in data["skills"] if s["name"].strip()]
    data["is_tutor"] = bool(data.get("is_tutor", False))
    data["tutor_subjects"] = (
        [s.strip() for s in data.get("tutor_subjects", []) if s.strip()]
        if data["is_tutor"]
        else []
    )
    data["tutor_slots"] = (
        [s.strip() for s in data.get("tutor_slots", []) if s.strip()]
        if data["is_tutor"]
        else []
    )
    data["contact_info"] = (data.get("contact_info") or "").strip()
    await db.users.update_one({"id": user["id"]}, {"$set": data})
    if data["name"] != user["name"]:
        await db.workspaces.update_many(
            {"members.id": user["id"]}, {"$set": {"members.$.name": data["name"]}}
        )
    return public_user({**user, **data})


@router.post("/users/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...), user: dict = Depends(get_current_user)
):
    ext = IMAGE_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(400, "Format d'image non supporté (JPG, PNG ou WebP)")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(413, "Image trop lourde (5 Mo max)")
    try:
        result = await put_object(
            f"{APP_NAME}/avatars/{user['id']}/{new_id()}.{ext}", data, file.content_type
        )
    except Exception as exc:
        logger.error("avatar upload failed: %s", exc)
        raise HTTPException(502, "Échec de l'envoi de la photo")
    v = now_iso()
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "avatar_path": result["path"],
                "avatar_type": file.content_type,
                "avatar_v": v,
            }
        },
    )
    return public_user({**user, "avatar_v": v})


@router.get("/users/{user_id}/avatar")
async def get_avatar(user_id: str, user: dict = Depends(get_current_user)):
    u = await db.users.find_one(
        {"id": user_id}, {"_id": 0, "avatar_path": 1, "avatar_type": 1}
    )
    if not u or not u.get("avatar_path"):
        raise HTTPException(404, "Pas de photo")
    data = await get_object(u["avatar_path"])
    return Response(
        content=data,
        media_type=u.get("avatar_type", "image/jpeg"),
        headers={"Cache-Control": "private, max-age=86400"},
    )


@router.get("/users/{user_id}/profile")
async def get_profile(user_id: str, user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(404, "Étudiant introuvable")
    docs = (
        await db.documents.find(
            {"author_id": user_id, "is_deleted": False},
            {
                "_id": 0,
                "id": 1,
                "title": 1,
                "format": 1,
                "subject": 1,
                "filiere": 1,
                "annee": 1,
                "is_annale": 1,
                "is_validated": 1,
                "upvotes": 1,
                "downvotes": 1,
                "current_version": 1,
                "updated_at": 1,
            },
        )
        .sort("updated_at", -1)
        .to_list(50)
    )
    for d in docs:
        d["score"] = len(d.pop("upvotes", [])) - len(d.pop("downvotes", []))
    profile = public_user(u)
    if user_id != user["id"]:
        profile.pop("email", None)
    return {"user": profile, **(await compute_stats(user_id)), "documents": docs}
