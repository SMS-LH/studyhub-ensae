import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import db, format_ensae_level, get_current_user, new_id, now_iso, ENSAE_CLASSES

router = APIRouter(prefix="/api/feed")


def _class_filter(user: dict) -> dict:
    cn = (user.get("class_name") or "").strip()
    if cn:
        return {"class_name": cn}
    # Legacy compat
    fil = (user.get("filiere") or "").strip().upper()
    yr = user.get("annee")
    if fil and yr:
        return {"filiere": fil, "annee": yr}
    return {"filiere": fil} if fil else {}


def _is_class_admin(user: dict) -> bool:
    return user.get("role") in ("moderator", "admin", "class_admin")


def _serialize_post(p: dict, user_id: str) -> dict:
    likes = p.get("likes", [])
    saved = p.get("saved_by", [])
    poll = p.get("poll")
    poll_out = None
    if poll:
        opts = []
        total_votes = 0
        my_vote = None
        for idx, opt in enumerate(poll):
            voters = opt.get("voters", [])
            total_votes += len(voters)
            if user_id in voters:
                my_vote = idx
            opts.append({"text": opt["text"], "votes": len(voters)})
        poll_out = {"options": opts, "total_votes": total_votes, "my_vote": my_vote}
    out = {k: v for k, v in p.items() if k not in ("likes", "saved_by", "poll", "_id")}
    out["like_count"] = len(likes)
    out["liked"] = user_id in likes
    out["saved"] = user_id in saved
    out["poll"] = poll_out
    return out


async def _notify_mentions(text: str, user: dict, class_flt: dict, post_id: str):
    names = set(re.findall(r"@([A-Za-zÀ-ÿ0-9_-]{2,30})", text or ""))
    if not names:
        return
    from notification_routes import notify

    members = await db.users.find(class_flt, {"_id": 0, "id": 1, "name": 1}).to_list(200)
    for m in members:
        if m["id"] == user["id"]:
            continue
        first = (m["name"] or "").split()[0].lower()
        full = (m["name"] or "").lower().replace(" ", "")
        if any(n.lower() in (first, full) for n in names):
            await notify(
                m["id"],
                f"mention:{post_id}:{m['id']}",
                "mention",
                f"{user['name']} t'a mentionné",
                text[:100],
                "/fil",
            )


class FeedPostIn(BaseModel):
    text: str = Field(min_length=1, max_length=3000)
    kind: str = Field(default="post", pattern="^(post|question|annonce|binome)$")
    subject: str = Field(default="", max_length=80)
    poll_options: list[str] = Field(default=[], max_length=6)
    linked_doc_id: str | None = None


class FeedCommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=1500)


class ClassEventIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    subject: str = Field(default="", max_length=80)
    event_date: str = Field(min_length=4, max_length=40)
    kind: str = Field(default="DS", pattern="^(DS|Partiel|TD|Autre)$")


@router.get("")
async def get_class_feed(
    filter: str = "all",
    q: str = "",
    user: dict = Depends(get_current_user),
):
    flt: dict = _class_filter(user)
    if filter == "pinned":
        flt["is_pinned"] = True
    elif filter == "polls":
        flt["poll"] = {"$ne": None}
    elif filter == "saved":
        flt["saved_by"] = user["id"]
    elif filter == "questions":
        flt["kind"] = "question"
    elif filter == "binomes":
        flt["kind"] = "binome"

    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        flt["$or"] = [{"text": rx}, {"subject": rx}, {"author_name": rx}]

    posts = (
        await db.class_posts.find(flt, {"_id": 0})
        .sort([("is_pinned", -1), ("created_at", -1)])
        .to_list(150)
    )
    return [_serialize_post(p, user["id"]) for p in posts]


@router.post("")
async def create_feed_post(body: FeedPostIn, user: dict = Depends(get_current_user)):
    fil = (user.get("filiere") or "").strip().upper()
    yr = user.get("annee")
    if body.kind == "annonce" and not _is_class_admin(user):
        raise HTTPException(403, "Seul l'administrateur de classe peut publier une annonce officielle")

    clean_opts = [o.strip() for o in body.poll_options if o.strip()]
    poll = [{"text": o, "voters": []} for o in clean_opts] if len(clean_opts) >= 2 else None

    linked_doc = None
    if body.linked_doc_id:
        d = await db.documents.find_one(
            {"id": body.linked_doc_id, "is_deleted": False},
            {"_id": 0, "id": 1, "title": 1, "format": 1, "subject": 1},
        )
        if d:
            linked_doc = d

    post = {
        "id": new_id(),
        "class_name": user.get("class_name") or format_ensae_level(user.get("filiere"), user.get("annee")) or "ENSAE",
        # Legacy fields for compat
        "filiere": (user.get("filiere") or "").strip().upper(),
        "annee": user.get("annee"),
        "class_label": user.get("class_name") or format_ensae_level(user.get("filiere"), user.get("annee")) or "ENSAE",
        "author_id": user["id"],
        "author_name": user["name"],
        "author_role": user.get("role", "student"),
        "author_is_tutor": bool(user.get("is_tutor", False)),
        "author_avatar_v": user.get("avatar_v"),
        "text": body.text.strip(),
        "kind": body.kind,
        "subject": body.subject.strip(),
        "poll": poll,
        "linked_doc": linked_doc,
        "is_pinned": body.kind == "annonce" and _is_class_admin(user),
        "likes": [],
        "saved_by": [],
        "comments": [],
        "created_at": now_iso(),
    }
    await db.class_posts.insert_one(dict(post))
    await _notify_mentions(post["text"], user, _class_filter(user), post["id"])
    if post["kind"] == "annonce":
        from notification_routes import notify

        members = await db.users.find(_class_filter(user), {"_id": 0, "id": 1}).to_list(300)
        for m in members:
            if m["id"] != user["id"]:
                await notify(
                    m["id"],
                    f"annonce:{post['id']}:{m['id']}",
                    "annonce",
                    f"Annonce {post['class_label']} · {user['name']}",
                    post["text"][:100],
                    "/fil",
                )
    return _serialize_post(post, user["id"])


@router.post("/{post_id}/react")
async def toggle_like(post_id: str, user: dict = Depends(get_current_user)):
    p = await db.class_posts.find_one({"id": post_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Publication introuvable")
    likes = p.get("likes", [])
    if user["id"] in likes:
        await db.class_posts.update_one({"id": post_id}, {"$pull": {"likes": user["id"]}})
        liked, count = False, len(likes) - 1
    else:
        await db.class_posts.update_one({"id": post_id}, {"$addToSet": {"likes": user["id"]}})
        liked, count = True, len(likes) + 1
    return {"liked": liked, "like_count": count}


@router.post("/{post_id}/bookmark")
async def toggle_bookmark(post_id: str, user: dict = Depends(get_current_user)):
    p = await db.class_posts.find_one({"id": post_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Publication introuvable")
    saved = p.get("saved_by", [])
    if user["id"] in saved:
        await db.class_posts.update_one({"id": post_id}, {"$pull": {"saved_by": user["id"]}})
        return {"saved": False}
    await db.class_posts.update_one({"id": post_id}, {"$addToSet": {"saved_by": user["id"]}})
    return {"saved": True}


@router.post("/{post_id}/vote/{option_idx}")
async def vote_poll(post_id: str, option_idx: int, user: dict = Depends(get_current_user)):
    p = await db.class_posts.find_one({"id": post_id}, {"_id": 0})
    if not p or not p.get("poll"):
        raise HTTPException(404, "Sondage introuvable")
    poll = p["poll"]
    if option_idx < 0 or option_idx >= len(poll):
        raise HTTPException(400, "Option invalide")
    for opt in poll:
        if user["id"] in opt.get("voters", []):
            opt["voters"].remove(user["id"])
    poll[option_idx].setdefault("voters", []).append(user["id"])
    await db.class_posts.update_one({"id": post_id}, {"$set": {"poll": poll}})
    return _serialize_post({**p, "poll": poll}, user["id"])


@router.post("/{post_id}/comment")
async def add_comment(
    post_id: str, body: FeedCommentIn, user: dict = Depends(get_current_user)
):
    p = await db.class_posts.find_one({"id": post_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Publication introuvable")
    c = {
        "id": new_id(),
        "author_id": user["id"],
        "author_name": user["name"],
        "author_role": user.get("role", "student"),
        "text": body.text.strip(),
        "created_at": now_iso(),
    }
    await db.class_posts.update_one({"id": post_id}, {"$push": {"comments": c}})
    if p["author_id"] != user["id"]:
        from notification_routes import notify

        await notify(
            p["author_id"],
            f"feed_comment:{post_id}:{c['id']}",
            "feed_comment",
            f"{user['name']} a commenté ta publication",
            c["text"][:100],
            "/fil",
        )
    await _notify_mentions(c["text"], user, _class_filter(user), post_id)
    return c


@router.post("/{post_id}/pin")
async def toggle_pin(post_id: str, user: dict = Depends(get_current_user)):
    if not _is_class_admin(user):
        raise HTTPException(403, "Réservé à l'administrateur de classe")
    p = await db.class_posts.find_one({"id": post_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Publication introuvable")
    new_pin = not bool(p.get("is_pinned", False))
    await db.class_posts.update_one({"id": post_id}, {"$set": {"is_pinned": new_pin}})
    return {"is_pinned": new_pin}


@router.delete("/{post_id}")
async def delete_feed_post(post_id: str, user: dict = Depends(get_current_user)):
    p = await db.class_posts.find_one({"id": post_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Publication introuvable")
    if p["author_id"] != user["id"] and not _is_class_admin(user):
        raise HTTPException(403, "Non autorisé")
    await db.class_posts.delete_one({"id": post_id})
    return {"ok": True}


# ---------- Class Weekly Schedule / Exams ----------
@router.get("/events")
async def list_class_events(user: dict = Depends(get_current_user)):
    flt = _class_filter(user)
    return (
        await db.class_events.find(flt, {"_id": 0})
        .sort("event_date", 1)
        .to_list(30)
    )


@router.post("/events")
async def create_class_event(body: ClassEventIn, user: dict = Depends(get_current_user)):
    if not _is_class_admin(user):
        raise HTTPException(403, "Seul l'administrateur de classe peut ajouter un examen")
    ev = {
        "id": new_id(),
        "filiere": (user.get("filiere") or "").strip().upper(),
        "annee": user.get("annee"),
        "title": body.title.strip(),
        "subject": body.subject.strip(),
        "event_date": body.event_date.strip(),
        "kind": body.kind,
        "created_by": user["name"],
        "created_at": now_iso(),
    }
    await db.class_events.insert_one(dict(ev))
    return ev


@router.delete("/events/{event_id}")
async def delete_class_event(event_id: str, user: dict = Depends(get_current_user)):
    if not _is_class_admin(user):
        raise HTTPException(403, "Réservé à l'administrateur de classe")
    await db.class_events.delete_one({"id": event_id})
    return {"ok": True}
