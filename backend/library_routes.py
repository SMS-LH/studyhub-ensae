import asyncio
import json
import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from core import (
    APP_NAME,
    MAX_UPLOAD,
    ask_json,
    db,
    detect_format,
    extract_text,
    file_ext,
    format_ensae_level,
    get_current_user,
    get_object,
    guess_mime,
    is_senior_tutor,
    logger,
    new_id,
    normalize_ensae_level,
    now_iso,
    put_object,
)

router = APIRouter(prefix="/api")
_bg_tasks: set = set()


def run_bg(coro):
    t = asyncio.create_task(coro)
    _bg_tasks.add(t)
    t.add_done_callback(_bg_tasks.discard)


def public_doc(doc: dict, user_id: str, include_text: bool = False) -> dict:
    ups, downs = doc.get("upvotes", []), doc.get("downvotes", [])
    out = {
        k: v
        for k, v in doc.items()
        if k not in ("upvotes", "downvotes", "text_content", "_id", "is_deleted")
    }
    out.setdefault("filiere", "")
    out.setdefault("annee", None)
    out.setdefault("is_annale", False)
    out.setdefault("annale_year", "")
    out.setdefault("professor", "")
    out.setdefault("is_validated", False)
    out.setdefault("validated_by_id", None)
    out.setdefault("validated_by_name", "")
    out.setdefault("validated_by_level", "")
    out.setdefault("validated_at", None)
    out.setdefault("shared_from_level", "")
    saved_by = doc.get("saved_by", [])
    out.pop("saved_by", None)
    out.update(
        {
            "upvote_count": len(ups),
            "downvote_count": len(downs),
            "score": len(ups) - len(downs),
            "my_vote": 1 if user_id in ups else (-1 if user_id in downs else 0),
            "saved": user_id in saved_by,
        }
    )
    if include_text:
        out["text_content"] = doc.get("text_content", "")
    return out


async def get_doc(doc_id: str) -> dict:
    doc = await db.documents.find_one({"id": doc_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Fiche introuvable")
    return doc


async def analyze_document(doc_id: str, title: str, text: str):
    if not text:
        return
    try:
        data = await ask_json(
            f"Titre : {title}\n\nContenu :\n{text[:15000]}",
            "Tu indexes des documents de cours et scripts statistiques de l'ENSAE "
            "(Statistiques, Probabilités, Économétrie, Macro/Microéconomie, Data Science, R, Python, SAS, Stata). "
            'Renvoie {"concepts": [8 à 12 concepts/notions clés en français], "abstract": "résumé précis de 2 phrases"}.',
        )
        await db.documents.update_one(
            {"id": doc_id},
            {
                "$set": {
                    "concepts": [str(c) for c in data.get("concepts", [])][:12],
                    "abstract": str(data.get("abstract", "")),
                }
            },
        )
    except Exception as exc:
        logger.warning("analyze_document failed: %s", exc)


async def store_upload(file: UploadFile, user: dict) -> tuple[dict, str, str]:
    fmt = detect_format(file.filename or "")
    if not fmt:
        raise HTTPException(
            400,
            "Format non supporté (PDF, Word, PowerPoint, vidéo, code R/Python/Stata/SAS ou texte)",
        )
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Fichier trop volumineux (100 Mo max)")
    if not data:
        raise HTTPException(400, "Fichier vide")
    content_type = guess_mime(file.filename, file.content_type)
    path = (
        f"{APP_NAME}/uploads/{user['id']}/{new_id()}.{file_ext(file.filename) or 'bin'}"
    )
    try:
        result = await put_object(path, data, content_type)
    except Exception as exc:
        logger.error("upload failed: %s", exc)
        raise HTTPException(502, "Échec de l'envoi du fichier, réessaie.")
    text = await asyncio.to_thread(extract_text, data, file.filename)
    file_rec = {
        "id": new_id(),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": len(data),
        "owner_id": user["id"],
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.files.insert_one(dict(file_rec))
    return file_rec, text, fmt


def version_entry(num: int, file_rec: dict, user: dict, changelog: str) -> dict:
    return {
        "version": num,
        "file_id": file_rec["id"],
        "filename": file_rec["original_filename"],
        "content_type": file_rec["content_type"],
        "size": file_rec["size"],
        "changelog": changelog,
        "author_id": user["id"],
        "author_name": user["name"],
        "created_at": now_iso(),
    }


@router.get("/stats/overview")
async def stats_overview(user: dict = Depends(get_current_user)):
    return {
        "total_docs": await db.documents.count_documents({"is_deleted": False}),
        "total_annales": await db.documents.count_documents(
            {"is_deleted": False, "is_annale": True}
        ),
        "total_code": await db.documents.count_documents(
            {"is_deleted": False, "format": "code"}
        ),
        "total_validated": await db.documents.count_documents(
            {"is_deleted": False, "is_validated": True}
        ),
        "total_tutors": await db.users.count_documents(
            {"is_tutor": True, "role": {"$ne": "admin"}}
        ),
        "total_students": await db.users.count_documents({"role": {"$ne": "admin"}}),
        "total_tutoring_completed": await db.tutoring_requests.count_documents(
            {"status": "completed"}
        ),
        "total_promo_spaces": await db.workspaces.count_documents({"type": "promo"}),
    }


@router.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    subject: str = Form("Autre"),
    level: str = Form(""),
    filiere: str = Form(""),
    annee: str = Form(""),
    is_annale: bool = Form(False),
    annale_year: str = Form(""),
    professor: str = Form(""),
    tags: str = Form(""),
    user: dict = Depends(get_current_user),
):
    fil, yr = normalize_ensae_level(
        filiere or user.get("filiere", ""),
        annee or (user.get("annee") if not filiere else None),
    )
    computed_level = level.strip() or format_ensae_level(fil, yr)
    user_level = format_ensae_level(user.get("filiere"), user.get("annee"))
    shared_from = user_level if (user_level and computed_level and user_level != computed_level) else ""
    file_rec, text, fmt = await store_upload(file, user)
    doc = {
        "id": new_id(),
        "title": title.strip(),
        "description": description.strip(),
        "subject": subject,
        "level": computed_level,
        "filiere": fil,
        "annee": yr,
        "shared_from_level": shared_from,
        "is_annale": bool(is_annale),
        "annale_year": annale_year.strip(),
        "professor": professor.strip(),
        "is_validated": False,
        "validated_by_id": None,
        "validated_by_name": "",
        "validated_by_level": "",
        "validated_at": None,
        "tags": [t.strip() for t in tags.split(",") if t.strip()],
        "format": fmt,
        "author_id": user["id"],
        "author_name": user["name"],
        "author_filiere": user.get("filiere", ""),
        "author_annee": user.get("annee"),
        "university": user.get("university", "ENSAE"),
        "current_version": 1,
        "versions": [version_entry(1, file_rec, user, "Version initiale")],
        "text_content": text,
        "text_excerpt": text[:1500],
        "concepts": [],
        "abstract": "",
        "upvotes": [],
        "downvotes": [],
        "saved_by": [],
        "comment_count": 0,
        "is_deleted": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.documents.insert_one(dict(doc))
    run_bg(analyze_document(doc["id"], doc["title"], text))
    return public_doc(doc, user["id"])


@router.get("/documents")
async def list_documents(
    q: str = "",
    subject: str = "",
    format: str = "",
    level: str = "",
    filiere: str = "",
    annee: int | None = None,
    is_annale: bool | None = None,
    professor: str = "",
    validated_only: bool = False,
    saved_only: bool = False,
    sort: str = "recent",
    mine: bool = False,
    user: dict = Depends(get_current_user),
):
    flt: dict = {"is_deleted": False}
    # Scope library to the user's own class by default
    u_fil = (user.get("filiere") or "").strip().upper()
    u_yr = user.get("annee")
    if u_fil and user.get("role") != "admin":
        flt["filiere"] = u_fil
        if u_yr is not None:
            flt["annee"] = u_yr
    else:
        if filiere:
            flt["filiere"] = filiere.strip().upper()
        if annee is not None:
            flt["annee"] = annee
    if subject:
        flt["subject"] = subject
    if format:
        flt["format"] = format
    if level:
        flt["level"] = level
    if is_annale is not None:
        flt["is_annale"] = is_annale
    if professor.strip():
        flt["professor"] = {"$regex": re.escape(professor.strip()), "$options": "i"}
    if validated_only:
        flt["is_validated"] = True
    if saved_only:
        flt["saved_by"] = user["id"]
    if mine:
        flt["author_id"] = user["id"]
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        flt["$or"] = [
            {"title": rx},
            {"description": rx},
            {"tags": rx},
            {"concepts": rx},
            {"subject": rx},
        ]
    docs = (
        await db.documents.find(flt, {"_id": 0, "text_content": 0})
        .sort("updated_at", -1)
        .to_list(300)
    )
    out = [public_doc(d, user["id"]) for d in docs]
    if sort == "top":
        out.sort(key=lambda d: d["score"], reverse=True)
    return out


class SearchIn(BaseModel):
    query: str


@router.post("/documents/search")
async def semantic_search(body: SearchIn, user: dict = Depends(get_current_user)):
    query = body.query.strip()
    if not query:
        raise HTTPException(400, "Saisis un concept à rechercher")
    proj = {"_id": 0, "text_content": 0}
    try:
        text_hits = (
            await db.documents.find(
                {"is_deleted": False, "$text": {"$search": query}},
                {**proj, "s": {"$meta": "textScore"}},
            )
            .sort([("s", {"$meta": "textScore"})])
            .to_list(30)
        )
    except Exception:
        rx = {"$regex": re.escape(query), "$options": "i"}
        text_hits = await db.documents.find(
            {
                "is_deleted": False,
                "$or": [
                    {"title": rx},
                    {"description": rx},
                    {"concepts": rx},
                    {"tags": rx},
                    {"text_excerpt": rx},
                ],
            },
            proj,
        ).to_list(30)
    others = (
        await db.documents.find({"is_deleted": False}, proj)
        .sort("updated_at", -1)
        .to_list(60)
    )
    pool = {d["id"]: d for d in others + text_hits}
    if not pool:
        return {"results": []}
    catalog = [
        {
            "id": d["id"],
            "titre": d["title"],
            "matière": d.get("subject"),
            "filiere": d.get("filiere"),
            "annee": d.get("annee"),
            "description": d.get("description"),
            "concepts": d.get("concepts", []),
            "résumé": d.get("abstract"),
            "tags": d.get("tags", []),
            "extrait": (d.get("text_excerpt") or "")[:700],
        }
        for d in pool.values()
    ]
    data = await ask_json(
        f"Requête de l'étudiant : « {query} »\n\nCatalogue :\n{json.dumps(catalog, ensure_ascii=False)}",
        "Tu es un moteur de recherche sémantique pour les cours, scripts R/Python et annales de l'ENSAE. "
        'Trouve les documents qui traitent du CONCEPT demandé (synonymes, notions liées). Renvoie {"results": [{"id": ..., '
        '"relevance": 0-100, "reason": "pourquoi ce document correspond, 1 phrase"}]} triés par pertinence, '
        "maximum 10, en excluant ceux dont la pertinence est inférieure à 35.",
    )
    results = []
    for r in data.get("results", []) if isinstance(data, dict) else []:
        d = pool.get(r.get("id"))
        if d:
            results.append(
                {
                    **public_doc(d, user["id"]),
                    "relevance": r.get("relevance", 0),
                    "reason": r.get("reason", ""),
                }
            )
    if not results and text_hits:
        results = [
            {
                **public_doc(d, user["id"]),
                "relevance": 80,
                "reason": "Correspondance directe avec les termes recherchés.",
            }
            for d in text_hits[:10]
        ]
    return {"results": results}


@router.get("/documents/{doc_id}")
async def document_detail(doc_id: str, user: dict = Depends(get_current_user)):
    return public_doc(await get_doc(doc_id), user["id"], include_text=True)


@router.get("/documents/{doc_id}/file")
async def document_file(
    doc_id: str, version: int = Query(None), user: dict = Depends(get_current_user)
):
    doc = await get_doc(doc_id)
    num = version or doc["current_version"]
    entry = next((v for v in doc["versions"] if v["version"] == num), None)
    if not entry:
        raise HTTPException(404, "Version introuvable")
    rec = await db.files.find_one(
        {"id": entry["file_id"], "is_deleted": False}, {"_id": 0}
    )
    if not rec:
        raise HTTPException(404, "Fichier introuvable")
    try:
        data = await get_object(rec["storage_path"])
    except Exception as exc:
        logger.error("download failed: %s", exc)
        raise HTTPException(502, "Impossible de récupérer le fichier")
    return Response(
        content=data,
        media_type=rec["content_type"],
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{rec['original_filename']}"
        },
    )


@router.post("/documents/{doc_id}/validate")
async def validate_document(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await get_doc(doc_id)
    can_validate = is_senior_tutor(user) or (
        bool(user.get("is_tutor"))
        and doc.get("annee")
        and int(user.get("annee") or 0) > int(doc["annee"])
    )
    if not can_validate:
        raise HTTPException(
            403,
            "Seul un tuteur de niveau supérieur (ISE 3+ ou AS 2+) peut valider cette fiche",
        )
    if doc["author_id"] == user["id"] and user.get("role") != "admin":
        raise HTTPException(400, "Tu ne peux pas auto-valider ta propre fiche")
    new_val = not bool(doc.get("is_validated", False))
    fields = (
        {
            "is_validated": True,
            "validated_by_id": user["id"],
            "validated_by_name": user["name"],
            "validated_by_level": format_ensae_level(
                user.get("filiere"), user.get("annee")
            ),
            "validated_at": now_iso(),
        }
        if new_val
        else {
            "is_validated": False,
            "validated_by_id": None,
            "validated_by_name": "",
            "validated_by_level": "",
            "validated_at": None,
        }
    )
    await db.documents.update_one({"id": doc_id}, {"$set": fields})
    if new_val:
        from notification_routes import notify

        await notify(
            doc["author_id"],
            f"doc_validated:{doc_id}",
            "doc_validated",
            "Fiche validée par un tuteur !",
            f"{user['name']} a validé ta fiche « {doc['title']} » pour la promo.",
            f"/fiche/{doc_id}",
        )
    return public_doc(await get_doc(doc_id), user["id"], include_text=True)


class VoteIn(BaseModel):
    value: int


@router.post("/documents/{doc_id}/vote")
async def vote(doc_id: str, body: VoteIn, user: dict = Depends(get_current_user)):
    await get_doc(doc_id)
    uid = user["id"]
    await db.documents.update_one(
        {"id": doc_id}, {"$pull": {"upvotes": uid, "downvotes": uid}}
    )
    if body.value in (1, -1):
        await db.documents.update_one(
            {"id": doc_id},
            {"$addToSet": {"upvotes" if body.value == 1 else "downvotes": uid}},
        )
    return public_doc(await get_doc(doc_id), uid)


@router.post("/documents/{doc_id}/versions")
async def new_version(
    doc_id: str,
    file: UploadFile = File(...),
    changelog: str = Form(...),
    user: dict = Depends(get_current_user),
):
    doc = await get_doc(doc_id)
    file_rec, text, fmt = await store_upload(file, user)
    num = doc["current_version"] + 1
    await db.documents.update_one(
        {"id": doc_id},
        {
            "$push": {
                "versions": version_entry(num, file_rec, user, changelog.strip())
            },
            "$set": {
                "current_version": num,
                "format": fmt,
                "text_content": text,
                "text_excerpt": text[:1500],
                "updated_at": now_iso(),
            },
        },
    )
    run_bg(analyze_document(doc_id, doc["title"], text))
    return public_doc(await get_doc(doc_id), user["id"])


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await get_doc(doc_id)
    if doc["author_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "Seul l'auteur peut supprimer cette fiche")
    await db.documents.update_one({"id": doc_id}, {"$set": {"is_deleted": True}})
    return {"ok": True}


class CommentIn(BaseModel):
    text: str
    kind: str = "comment"
    page: str = ""


@router.get("/documents/{doc_id}/comments")
async def list_comments(doc_id: str, user: dict = Depends(get_current_user)):
    return (
        await db.comments.find({"document_id": doc_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(500)
    )


@router.post("/documents/{doc_id}/comments")
async def add_comment(
    doc_id: str, body: CommentIn, user: dict = Depends(get_current_user)
):
    doc = await get_doc(doc_id)
    if not body.text.strip():
        raise HTTPException(400, "Le commentaire est vide")
    c = {
        "id": new_id(),
        "document_id": doc_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "text": body.text.strip(),
        "kind": "error" if body.kind == "error" else "comment",
        "page": body.page,
        "version": doc["current_version"],
        "resolved": False,
        "created_at": now_iso(),
    }
    await db.comments.insert_one(dict(c))
    await db.documents.update_one({"id": doc_id}, {"$inc": {"comment_count": 1}})
    return c


@router.patch("/comments/{comment_id}/resolve")
async def resolve_comment(comment_id: str, user: dict = Depends(get_current_user)):
    c = await db.comments.find_one({"id": comment_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Commentaire introuvable")
    doc = await get_doc(c["document_id"])
    if (
        user["id"] not in (c["user_id"], doc["author_id"])
        and user.get("role") != "admin"
    ):
        raise HTTPException(
            403, "Seul l'auteur de la fiche ou du signalement peut changer son statut"
        )
    await db.comments.update_one(
        {"id": comment_id}, {"$set": {"resolved": not c["resolved"]}}
    )
    c["resolved"] = not c["resolved"]
    return c


@router.post("/documents/{doc_id}/bookmark")
async def bookmark_document(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await get_doc(doc_id)
    saved = doc.get("saved_by", [])
    if user["id"] in saved:
        await db.documents.update_one({"id": doc_id}, {"$pull": {"saved_by": user["id"]}})
        return {"saved": False}
    await db.documents.update_one({"id": doc_id}, {"$addToSet": {"saved_by": user["id"]}})
    return {"saved": True}
