from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import db, format_ensae_level, get_current_user, new_id, now_iso, public_user

router = APIRouter(prefix="/api/chat")


class ChatMessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@router.get("/conversations")
async def list_conversations(user: dict = Depends(get_current_user)):
    uid = user["id"]
    msgs = (
        await db.direct_messages.find(
            {"$or": [{"sender_id": uid}, {"recipient_id": uid}]}, {"_id": 0}
        )
        .sort("created_at", -1)
        .to_list(500)
    )
    conv_map: dict[str, dict] = {}
    for m in msgs:
        other_id = m["recipient_id"] if m["sender_id"] == uid else m["sender_id"]
        if other_id not in conv_map:
            conv_map[other_id] = {
                "other_id": other_id,
                "last_message": m["text"],
                "last_at": m["created_at"],
                "unread": 0,
            }
        if m["recipient_id"] == uid and not m.get("read", False):
            conv_map[other_id]["unread"] += 1

    out = []
    for other_id, info in conv_map.items():
        other = await db.users.find_one({"id": other_id}, {"_id": 0, "password_hash": 0})
        if not other:
            continue
        pu = public_user(other)
        pu.pop("email", None)
        out.append({**info, "user": pu})
    return out


@router.get("/dm/{other_id}")
async def get_dm_thread(other_id: str, user: dict = Depends(get_current_user)):
    uid = user["id"]
    other = await db.users.find_one({"id": other_id}, {"_id": 0, "password_hash": 0})
    if not other:
        raise HTTPException(404, "Étudiant introuvable")
    await db.direct_messages.update_many(
        {"sender_id": other_id, "recipient_id": uid, "read": False},
        {"$set": {"read": True}},
    )
    msgs = (
        await db.direct_messages.find(
            {
                "$or": [
                    {"sender_id": uid, "recipient_id": other_id},
                    {"sender_id": other_id, "recipient_id": uid},
                ]
            },
            {"_id": 0},
        )
        .sort("created_at", 1)
        .to_list(200)
    )
    pu = public_user(other)
    pu.pop("email", None)
    return {"user": pu, "messages": msgs}


@router.post("/dm/{other_id}")
async def send_dm(
    other_id: str, body: ChatMessageIn, user: dict = Depends(get_current_user)
):
    if other_id == user["id"]:
        raise HTTPException(400, "Tu ne peux pas t'envoyer un message à toi-même")
    other = await db.users.find_one({"id": other_id}, {"_id": 0, "id": 1, "name": 1})
    if not other:
        raise HTTPException(404, "Étudiant introuvable")
    msg = {
        "id": new_id(),
        "sender_id": user["id"],
        "sender_name": user["name"],
        "sender_level": format_ensae_level(user.get("filiere"), user.get("annee")),
        "recipient_id": other_id,
        "text": body.text.strip(),
        "read": False,
        "created_at": now_iso(),
    }
    await db.direct_messages.insert_one(dict(msg))

    from notification_routes import notify

    await notify(
        other_id,
        f"dm:{msg['id']}",
        "direct_message",
        f"Nouveau message de {user['name']}",
        msg["text"][:100],
        f"/messages?user={user['id']}",
    )
    return msg


async def _check_ws_access(ws_id: str, user: dict):
    ws = await db.workspaces.find_one({"id": ws_id}, {"_id": 0})
    if not ws:
        raise HTTPException(404, "Espace introuvable")
    is_member = any(m["id"] == user["id"] for m in ws.get("members", []))
    if not is_member and not (ws.get("is_public") or ws.get("type") == "promo"):
        raise HTTPException(403, "Accès refusé à cet espace privé")
    return ws


@router.get("/workspace/{ws_id}")
async def get_workspace_chat(ws_id: str, user: dict = Depends(get_current_user)):
    await _check_ws_access(ws_id, user)
    return (
        await db.workspace_messages.find({"workspace_id": ws_id}, {"_id": 0})
        .sort("created_at", 1)
        .to_list(200)
    )


@router.post("/workspace/{ws_id}")
async def send_workspace_chat(
    ws_id: str, body: ChatMessageIn, user: dict = Depends(get_current_user)
):
    await _check_ws_access(ws_id, user)
    msg = {
        "id": new_id(),
        "workspace_id": ws_id,
        "author_id": user["id"],
        "author_name": user["name"],
        "author_level": format_ensae_level(user.get("filiere"), user.get("annee")),
        "is_tutor": bool(user.get("is_tutor", False)),
        "text": body.text.strip(),
        "created_at": now_iso(),
    }
    await db.workspace_messages.insert_one(dict(msg))
    return msg
