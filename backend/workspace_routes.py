import re
import secrets
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import (
    db,
    format_ensae_level,
    get_current_user,
    new_id,
    normalize_ensae_level,
    now_iso,
    word_count,
)

router = APIRouter(prefix="/api/workspaces")
forum_router = APIRouter(prefix="/api/forum")
STATUS_LABEL = {"todo": "À faire", "doing": "En cours", "done": "Terminé"}


async def log_activity(
    ws_id: str, user: dict, type_: str, message: str, amount: int = 1
):
    await db.activities.insert_one(
        {
            "id": new_id(),
            "workspace_id": ws_id,
            "user_id": user["id"],
            "user_name": user["name"],
            "type": type_,
            "message": message,
            "amount": amount,
            "created_at": now_iso(),
        }
    )


async def record_words(ws_id: str, user: dict, added: int):
    if added <= 0:
        return
    since = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
    last = await db.activities.find_one(
        {
            "workspace_id": ws_id,
            "user_id": user["id"],
            "type": "words_written",
            "created_at": {"$gte": since},
        },
        sort=[("created_at", -1)],
    )
    if last:
        total = last["amount"] + added
        await db.activities.update_one(
            {"id": last["id"]},
            {
                "$set": {
                    "amount": total,
                    "message": f"{user['name']} a écrit {total} mots dans les notes",
                    "created_at": now_iso(),
                }
            },
        )
    else:
        await log_activity(
            ws_id,
            user,
            "words_written",
            f"{user['name']} a écrit {added} mots dans les notes",
            added,
        )


async def notify_assignment(ws: dict, task: dict, user: dict):
    if task.get("assignee_id") and task["assignee_id"] != user["id"]:
        from notification_routes import notify

        await notify(
            task["assignee_id"],
            f"assign:{task['id']}:{task['assignee_id']}",
            "assignment",
            "Nouvelle tâche assignée",
            f"{user['name']} t'a assigné « {task['title']} » dans « {ws['name']} »",
            f"/espaces/{ws['id']}",
        )


async def get_ws(ws_id: str, user: dict, auto_join_public: bool = False) -> dict:
    ws = await db.workspaces.find_one({"id": ws_id}, {"_id": 0})
    if not ws:
        raise HTTPException(404, "Espace introuvable")
    is_member = user["id"] in [m["id"] for m in ws["members"]]
    if not is_member:
        if ws.get("is_public") or ws.get("type") == "promo":
            if auto_join_public:
                await db.workspaces.update_one(
                    {"id": ws_id},
                    {"$push": {"members": {"id": user["id"], "name": user["name"]}}},
                )
                ws["members"].append({"id": user["id"], "name": user["name"]})
        else:
            raise HTTPException(403, "Tu n'es pas membre de cet espace")
    return ws


class WorkspaceIn(BaseModel):
    name: str
    description: str = ""
    subject: str = ""
    type: str = "projet"
    filiere: str = ""
    annee: int | None = None


@router.get("")
async def my_workspaces(
    type: str = "", user: dict = Depends(get_current_user)
):
    u_fil = (user.get("filiere") or "").strip().upper()
    u_yr = user.get("annee")
    if u_fil and u_yr is not None:
        promo_cond: dict = {"type": "promo", "filiere": u_fil, "annee": u_yr}
    else:
        promo_cond = {"type": "promo"}
    flt: dict = {"$or": [{"members.id": user["id"], "type": {"$ne": "promo"}}, promo_cond]}
    if type in ("promo", "projet"):
        flt = {"$and": [flt, {"type": type}]}
    items = (
        await db.workspaces.find(flt, {"_id": 0, "notes": 0})
        .sort("created_at", -1)
        .to_list(200)
    )
    for ws in items:
        ws.setdefault("type", "projet")
        ws.setdefault("is_public", ws["type"] == "promo")
        ws["is_member"] = user["id"] in [m["id"] for m in ws.get("members", [])]
        ws["task_counts"] = {
            s: await db.tasks.count_documents({"workspace_id": ws["id"], "status": s})
            for s in STATUS_LABEL
        }
        ws["binome_count"] = await db.binomes.count_documents({"workspace_id": ws["id"]})
    # Sort promos nicely first or keep recent projects + ordered promos
    items.sort(
        key=lambda w: (
            0 if w.get("type") == "promo" else 1,
            w.get("filiere", ""),
            w.get("annee") or 0,
        )
    )
    return items


@router.post("")
async def create_workspace(body: WorkspaceIn, user: dict = Depends(get_current_user)):
    if not body.name.strip():
        raise HTTPException(400, "Donne un nom à ton espace")
    ws_type = "promo" if body.type == "promo" else "projet"
    fil, yr = normalize_ensae_level(body.filiere, body.annee)
    ws = {
        "id": new_id(),
        "name": body.name.strip(),
        "description": body.description.strip(),
        "subject": body.subject,
        "type": ws_type,
        "is_public": ws_type == "promo",
        "filiere": fil,
        "annee": yr,
        "owner_id": user["id"],
        "members": [{"id": user["id"], "name": user["name"]}],
        "invite_code": secrets.token_hex(3).upper(),
        "notes": "",
        "notes_updated_at": None,
        "created_at": now_iso(),
    }
    await db.workspaces.insert_one(dict(ws))
    await log_activity(
        ws["id"],
        user,
        "workspace_created",
        f"{user['name']} a créé l'espace « {ws['name']} »",
    )
    return ws


class JoinIn(BaseModel):
    code: str


@router.post("/join")
async def join_workspace(body: JoinIn, user: dict = Depends(get_current_user)):
    ws = await db.workspaces.find_one(
        {"invite_code": body.code.strip().upper()}, {"_id": 0}
    )
    if not ws:
        raise HTTPException(404, "Code d'invitation invalide")
    if user["id"] not in [m["id"] for m in ws["members"]]:
        await db.workspaces.update_one(
            {"id": ws["id"]},
            {"$push": {"members": {"id": user["id"], "name": user["name"]}}},
        )
        await log_activity(
            ws["id"], user, "member_joined", f"{user['name']} a rejoint l'espace"
        )
    return {"id": ws["id"]}


@router.post("/{ws_id}/join-public")
async def join_public_workspace(ws_id: str, user: dict = Depends(get_current_user)):
    ws = await db.workspaces.find_one({"id": ws_id}, {"_id": 0})
    if not ws:
        raise HTTPException(404, "Espace introuvable")
    if not (ws.get("is_public") or ws.get("type") == "promo"):
        raise HTTPException(403, "Cet espace privé nécessite un code d'invitation")
    if user["id"] not in [m["id"] for m in ws["members"]]:
        await db.workspaces.update_one(
            {"id": ws_id},
            {"$push": {"members": {"id": user["id"], "name": user["name"]}}},
        )
        await log_activity(
            ws_id, user, "member_joined", f"{user['name']} a rejoint l'amphi virtuel"
        )
    return {"id": ws_id, "joined": True}


@router.delete("/{ws_id}")
async def delete_workspace(ws_id: str, user: dict = Depends(get_current_user)):
    ws = await get_ws(ws_id, user)
    if ws.get("type") == "promo" and user.get("role") != "admin":
        raise HTTPException(403, "Les espaces de promo ENSAE sont permanents")
    if ws["owner_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "Seul le créateur peut supprimer l'espace")
    for col in ("workspaces", "tasks", "resources", "activities", "binomes"):
        key = "id" if col == "workspaces" else "workspace_id"
        await db[col].delete_many({key: ws_id})
    await db.notifications.delete_many({"link": f"/espaces/{ws_id}"})
    return {"ok": True}


@router.post("/{ws_id}/leave")
async def leave_workspace(ws_id: str, user: dict = Depends(get_current_user)):
    ws = await get_ws(ws_id, user)
    if ws["owner_id"] == user["id"]:
        raise HTTPException(
            400, "Le créateur ne peut pas quitter son espace, supprime-le plutôt"
        )
    await db.workspaces.update_one(
        {"id": ws_id}, {"$pull": {"members": {"id": user["id"]}}}
    )
    await log_activity(
        ws_id, user, "member_left", f"{user['name']} a quitté l'espace", 0
    )
    return {"ok": True}


@router.get("/{ws_id}")
async def workspace_detail(ws_id: str, user: dict = Depends(get_current_user)):
    ws = await get_ws(ws_id, user)
    ws.setdefault("type", "projet")
    ws.setdefault("is_public", ws["type"] == "promo")
    ws["is_member"] = user["id"] in [m["id"] for m in ws.get("members", [])]
    return ws


class NotesIn(BaseModel):
    content: str


@router.put("/{ws_id}/notes")
async def save_notes(ws_id: str, body: NotesIn, user: dict = Depends(get_current_user)):
    ws = await get_ws(ws_id, user, auto_join_public=True)
    added = word_count(body.content) - word_count(ws.get("notes", ""))
    await db.workspaces.update_one(
        {"id": ws_id},
        {
            "$set": {
                "notes": body.content,
                "notes_updated_at": now_iso(),
                "notes_updated_by": user["name"],
            }
        },
    )
    await record_words(ws_id, user, added)
    from live_notes import rooms

    room = rooms.get(ws_id)
    if room:
        async with room.lock:
            merged = room.apply(room.version, body.content)
            await room.broadcast(
                {
                    "type": "sync",
                    "content": merged,
                    "version": room.version,
                    "by": user["name"],
                    "user_id": user["id"],
                }
            )
    return {"ok": True, "words_added": max(added, 0), "updated_at": now_iso()}


# ---------- Binôme Board (Phase 4.4) ----------
class BinomeIn(BaseModel):
    subject: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(default="", max_length=500)
    spots_needed: int = Field(default=1, ge=1, le=5)


@router.get("/{ws_id}/binomes")
async def list_binomes(ws_id: str, user: dict = Depends(get_current_user)):
    await get_ws(ws_id, user)
    return (
        await db.binomes.find({"workspace_id": ws_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(200)
    )


@router.post("/{ws_id}/binomes")
async def create_binome(
    ws_id: str, body: BinomeIn, user: dict = Depends(get_current_user)
):
    await get_ws(ws_id, user, auto_join_public=True)
    post = {
        "id": new_id(),
        "workspace_id": ws_id,
        "subject": body.subject.strip(),
        "title": body.title.strip(),
        "description": body.description.strip(),
        "spots_needed": body.spots_needed,
        "author_id": user["id"],
        "author_name": user["name"],
        "author_level": format_ensae_level(user.get("filiere"), user.get("annee")),
        "interested": [],
        "created_at": now_iso(),
    }
    await db.binomes.insert_one(dict(post))
    await log_activity(
        ws_id,
        user,
        "binome_posted",
        f"{user['name']} cherche un binôme en {post['subject']} : « {post['title']} »",
    )
    return post


@router.post("/{ws_id}/binomes/{bid}/join")
async def toggle_binome(
    ws_id: str, bid: str, user: dict = Depends(get_current_user)
):
    await get_ws(ws_id, user, auto_join_public=True)
    b = await db.binomes.find_one({"id": bid, "workspace_id": ws_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Annonce introuvable")
    interested = b.get("interested", [])
    already = any(p["id"] == user["id"] for p in interested)
    if already:
        interested = [p for p in interested if p["id"] != user["id"]]
    else:
        interested.append({"id": user["id"], "name": user["name"]})
        if b["author_id"] != user["id"]:
            from notification_routes import notify

            await notify(
                b["author_id"],
                f"binome:{bid}:{user['id']}",
                "assignment",
                "Nouveau binôme intéressé !",
                f"{user['name']} souhaite faire équipe avec toi pour « {b['title']} ».",
                f"/espaces/{ws_id}",
            )
    await db.binomes.update_one({"id": bid}, {"$set": {"interested": interested}})
    return {**b, "interested": interested}


@router.delete("/{ws_id}/binomes/{bid}")
async def delete_binome(
    ws_id: str, bid: str, user: dict = Depends(get_current_user)
):
    await get_ws(ws_id, user)
    b = await db.binomes.find_one({"id": bid, "workspace_id": ws_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Annonce introuvable")
    if b["author_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "Seul l'auteur peut supprimer cette annonce")
    await db.binomes.delete_one({"id": bid})
    return {"ok": True}


# ---------- Tasks & Kanban ----------
class TaskIn(BaseModel):
    title: str
    description: str = ""
    assignee_id: str | None = None
    due_date: str | None = None
    status: str = "todo"


class TaskPatch(BaseModel):
    title: str | None = None
    description: str | None = None
    assignee_id: str | None = None
    due_date: str | None = None
    status: str | None = None


def valid_due(due: str | None) -> str | None:
    if not due:
        return None
    try:
        return date.fromisoformat(due).isoformat()
    except ValueError:
        raise HTTPException(400, "Date limite invalide (format AAAA-MM-JJ)")


def member_name(ws: dict, member_id: str | None) -> str | None:
    return next((m["name"] for m in ws["members"] if m["id"] == member_id), None)


@router.get("/{ws_id}/tasks")
async def list_tasks(ws_id: str, user: dict = Depends(get_current_user)):
    await get_ws(ws_id, user)
    return (
        await db.tasks.find({"workspace_id": ws_id}, {"_id": 0})
        .sort("created_at", 1)
        .to_list(1000)
    )


@router.post("/{ws_id}/tasks")
async def create_task(ws_id: str, body: TaskIn, user: dict = Depends(get_current_user)):
    ws = await get_ws(ws_id, user, auto_join_public=True)
    if not body.title.strip():
        raise HTTPException(400, "Le titre est obligatoire")
    if body.assignee_id and not member_name(ws, body.assignee_id):
        raise HTTPException(400, "La personne assignée doit être membre de l'espace")
    task = {
        "id": new_id(),
        "workspace_id": ws_id,
        "title": body.title.strip(),
        "description": body.description,
        "status": body.status if body.status in STATUS_LABEL else "todo",
        "assignee_id": body.assignee_id,
        "assignee_name": member_name(ws, body.assignee_id),
        "due_date": valid_due(body.due_date),
        "created_by": user["name"],
        "created_by_id": user["id"],
        "created_at": now_iso(),
        "completed_at": None,
    }
    await db.tasks.insert_one(dict(task))
    msg = f"{user['name']} a créé la tâche « {task['title']} »"
    if task["assignee_name"]:
        msg += f" assignée à {task['assignee_name']}"
    await log_activity(ws_id, user, "task_created", msg)
    await notify_assignment(ws, task, user)
    return task


@router.patch("/{ws_id}/tasks/{task_id}")
async def update_task(
    ws_id: str, task_id: str, body: TaskPatch, user: dict = Depends(get_current_user)
):
    ws = await get_ws(ws_id, user, auto_join_public=True)
    task = await db.tasks.find_one({"id": task_id, "workspace_id": ws_id}, {"_id": 0})
    if not task:
        raise HTTPException(404, "Tâche introuvable")
    changes = body.model_dump(exclude_unset=True)
    if "due_date" in changes:
        changes["due_date"] = valid_due(changes["due_date"])
    if "status" in changes and changes["status"] not in STATUS_LABEL:
        raise HTTPException(400, "Statut invalide")
    if changes.get("assignee_id") and not member_name(ws, changes["assignee_id"]):
        raise HTTPException(400, "La personne assignée doit être membre de l'espace")
    if "assignee_id" in changes:
        changes["assignee_name"] = member_name(ws, changes["assignee_id"])
    if changes.get("status") and changes["status"] != task["status"]:
        if changes["status"] == "done":
            changes["completed_at"] = now_iso()
            changes["completed_by"] = user["name"]
            changes["completed_by_id"] = user["id"]
            await log_activity(
                ws_id,
                user,
                "task_completed",
                f"{user['name']} a terminé « {task['title']} »",
            )
        else:
            await log_activity(
                ws_id,
                user,
                "task_moved",
                f"{user['name']} a déplacé « {task['title']} » vers {STATUS_LABEL[changes['status']]}",
            )
    await db.tasks.update_one({"id": task_id}, {"$set": changes})
    if changes.get("assignee_id") and changes["assignee_id"] != task.get("assignee_id"):
        await notify_assignment(ws, {**task, **changes}, user)
    return {**task, **changes}


@router.delete("/{ws_id}/tasks/{task_id}")
async def delete_task(ws_id: str, task_id: str, user: dict = Depends(get_current_user)):
    await get_ws(ws_id, user, auto_join_public=True)
    task = await db.tasks.find_one_and_delete({"id": task_id, "workspace_id": ws_id})
    if task:
        await log_activity(
            ws_id,
            user,
            "task_deleted",
            f"{user['name']} a supprimé « {task['title']} »",
            0,
        )
    return {"ok": True}


class ResourceIn(BaseModel):
    title: str
    url: str = ""
    document_id: str | None = None
    note: str = ""


@router.get("/{ws_id}/resources")
async def list_resources(ws_id: str, user: dict = Depends(get_current_user)):
    await get_ws(ws_id, user)
    return (
        await db.resources.find({"workspace_id": ws_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(500)
    )


@router.post("/{ws_id}/resources")
async def add_resource(
    ws_id: str, body: ResourceIn, user: dict = Depends(get_current_user)
):
    await get_ws(ws_id, user, auto_join_public=True)
    title = body.title.strip()
    if body.document_id:
        doc = await db.documents.find_one(
            {"id": body.document_id, "is_deleted": False}, {"_id": 0, "title": 1}
        )
        if not doc:
            raise HTTPException(404, "Fiche introuvable")
        title = title or doc["title"]
    if not title:
        raise HTTPException(400, "Le titre est obligatoire")
    res = {
        "id": new_id(),
        "workspace_id": ws_id,
        "title": title,
        "url": body.url.strip(),
        "document_id": body.document_id,
        "note": body.note,
        "added_by_id": user["id"],
        "added_by": user["name"],
        "created_at": now_iso(),
    }
    await db.resources.insert_one(dict(res))
    await log_activity(
        ws_id,
        user,
        "resource_added",
        f"{user['name']} a ajouté la ressource « {title} »",
    )
    return res


@router.delete("/{ws_id}/resources/{res_id}")
async def delete_resource(
    ws_id: str, res_id: str, user: dict = Depends(get_current_user)
):
    await get_ws(ws_id, user, auto_join_public=True)
    await db.resources.delete_one({"id": res_id, "workspace_id": ws_id})
    return {"ok": True}


@router.get("/{ws_id}/activity")
async def activity(ws_id: str, user: dict = Depends(get_current_user)):
    await get_ws(ws_id, user)
    return (
        await db.activities.find({"workspace_id": ws_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(200)
    )


@router.get("/{ws_id}/contributions")
async def contributions(ws_id: str, user: dict = Depends(get_current_user)):
    ws = await get_ws(ws_id, user)
    stats = {
        m["id"]: {
            "user_id": m["id"],
            "name": m["name"],
            "words_written": 0,
            "tasks_created": 0,
            "tasks_completed": 0,
            "resources_added": 0,
            "tasks_moved": 0,
        }
        for m in ws["members"]
    }
    field = {
        "words_written": "words_written",
        "task_completed": "tasks_completed",
        "resource_added": "resources_added",
        "task_moved": "tasks_moved",
    }
    async for a in db.activities.find({"workspace_id": ws_id}, {"_id": 0}):
        if a["user_id"] in stats and a["type"] in field:
            stats[a["user_id"]][field[a["type"]]] += a.get("amount", 1)
    for s in stats.values():
        s["tasks_created"] = await db.tasks.count_documents(
            {"workspace_id": ws_id, "created_by_id": s["user_id"]}
        )
        s["assigned_open"] = await db.tasks.count_documents(
            {
                "workspace_id": ws_id,
                "assignee_id": s["user_id"],
                "status": {"$ne": "done"},
            }
        )
        s["points"] = (
            s["words_written"] // 50
            + s["tasks_completed"] * 5
            + s["resources_added"] * 3
            + s["tasks_created"] * 2
            + s["tasks_moved"]
        )
    total = sum(s["points"] for s in stats.values()) or 1
    for s in stats.values():
        s["share"] = round(100 * s["points"] / total)
    return sorted(stats.values(), key=lambda s: s["points"], reverse=True)


# ---------- Global ENSAE Q&A Forum (Phase 7.4) ----------
class ForumPostIn(BaseModel):
    title: str = Field(min_length=4, max_length=180)
    body: str = Field(min_length=5, max_length=4000)
    subject: str = "Autre"
    filiere: str = ""
    tags: list[str] = []


class ForumReplyIn(BaseModel):
    body: str = Field(min_length=2, max_length=3000)


@forum_router.get("/posts")
async def list_forum_posts(
    subject: str = "",
    filiere: str = "",
    solved: bool | None = None,
    q: str = "",
    user: dict = Depends(get_current_user),
):
    flt: dict = {}
    u_fil = (user.get("filiere") or "").strip().upper()
    u_yr = user.get("annee")
    if u_fil and user.get("role") != "admin":
        flt["filiere"] = u_fil
        if u_yr is not None:
            flt["annee"] = u_yr
    elif filiere:
        flt["filiere"] = filiere.strip().upper()
    if subject:
        flt["subject"] = subject
    if solved is not None:
        flt["is_solved"] = solved
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        flt["$or"] = [{"title": rx}, {"body": rx}, {"subject": rx}, {"tags": rx}]
    posts = await db.forum_posts.find(flt, {"_id": 0}).sort("created_at", -1).to_list(200)
    for p in posts:
        ups = p.get("upvotes", [])
        p["upvote_count"] = len(ups)
        p["upvoted"] = user["id"] in ups
        p.pop("upvotes", None)
    return posts


@forum_router.post("/posts")
async def create_forum_post(
    body: ForumPostIn, user: dict = Depends(get_current_user)
):
    post = {
        "id": new_id(),
        "title": body.title.strip(),
        "body": body.body.strip(),
        "subject": body.subject.strip() or "Autre",
        "filiere": (body.filiere or user.get("filiere") or "").upper(),
        "annee": user.get("annee"),
        "tags": [t.strip() for t in body.tags if t.strip()][:8],
        "author_id": user["id"],
        "author_name": user["name"],
        "author_level": format_ensae_level(user.get("filiere"), user.get("annee")),
        "is_solved": False,
        "accepted_reply_id": None,
        "upvotes": [],
        "replies": [],
        "created_at": now_iso(),
    }
    await db.forum_posts.insert_one(dict(post))
    post["upvote_count"] = 0
    post["upvoted"] = False
    post.pop("upvotes", None)
    return post


@forum_router.post("/posts/{post_id}/replies")
async def reply_forum_post(
    post_id: str, body: ForumReplyIn, user: dict = Depends(get_current_user)
):
    post = await db.forum_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Question introuvable")
    reply = {
        "id": new_id(),
        "author_id": user["id"],
        "author_name": user["name"],
        "author_level": format_ensae_level(user.get("filiere"), user.get("annee")),
        "is_tutor": bool(user.get("is_tutor", False)),
        "body": body.body.strip(),
        "created_at": now_iso(),
    }
    await db.forum_posts.update_one({"id": post_id}, {"$push": {"replies": reply}})
    if post["author_id"] != user["id"]:
        from notification_routes import notify

        await notify(
            post["author_id"],
            f"forum_reply:{post_id}:{reply['id']}",
            "forum_reply",
            "Nouvelle réponse sur le forum ENSAE",
            f"{user['name']} a répondu à « {post['title']} ».",
            "/forum",
        )
    return reply


@forum_router.post("/posts/{post_id}/solve/{reply_id}")
async def solve_forum_post(
    post_id: str, reply_id: str, user: dict = Depends(get_current_user)
):
    post = await db.forum_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Question introuvable")
    if post["author_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "Seul l'auteur de la question peut valider la réponse")
    if not any(r["id"] == reply_id for r in post.get("replies", [])):
        raise HTTPException(404, "Réponse introuvable")
    await db.forum_posts.update_one(
        {"id": post_id},
        {"$set": {"is_solved": True, "accepted_reply_id": reply_id}},
    )
    return {"ok": True, "accepted_reply_id": reply_id}


@forum_router.post("/posts/{post_id}/upvote")
async def upvote_forum_post(post_id: str, user: dict = Depends(get_current_user)):
    post = await db.forum_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Question introuvable")
    ups = post.get("upvotes", [])
    if user["id"] in ups:
        await db.forum_posts.update_one(
            {"id": post_id}, {"$pull": {"upvotes": user["id"]}}
        )
        upvoted = False
        count = len(ups) - 1
    else:
        await db.forum_posts.update_one(
            {"id": post_id}, {"$addToSet": {"upvotes": user["id"]}}
        )
        upvoted = True
        count = len(ups) + 1
    return {"upvoted": upvoted, "upvote_count": count}
