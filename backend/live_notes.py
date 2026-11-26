import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from diff_match_patch import diff_match_patch

from core import db, logger, now_iso, user_from_token, word_count
from workspace_routes import record_words

router = APIRouter()
dmp = diff_match_patch()
MAX_LEN = 200000
HISTORY = 200


class Room:
    def __init__(self, content: str):
        self.content = content
        self.version = 0
        self.history = {0: content}
        self.clients: dict[WebSocket, dict] = {}
        self.lock = asyncio.Lock()

    def apply(self, base_version: int, text: str) -> str | None:
        if base_version != self.version:
            base = self.history.get(base_version)
            if base is None:
                return None
            text, _ = dmp.patch_apply(dmp.patch_make(base, text), self.content)
        self.version += 1
        self.content = text[:MAX_LEN]
        self.history[self.version] = self.content
        self.history.pop(self.version - HISTORY, None)
        return self.content

    def presence(self) -> list:
        seen = {}
        for info in self.clients.values():
            seen[info["id"]] = info
        return list(seen.values())

    async def broadcast(self, msg: dict, exclude: WebSocket | None = None):
        for client in list(self.clients):
            if client is exclude:
                continue
            try:
                await client.send_json(msg)
            except Exception:
                self.clients.pop(client, None)


rooms: dict[str, Room] = {}


@router.websocket("/api/ws/notes/{ws_id}")
async def live_notes(websocket: WebSocket, ws_id: str, token: str = ""):
    await websocket.accept()
    try:
        user = await user_from_token(token)
    except HTTPException:
        await websocket.close(code=4401)
        return
    ws = await db.workspaces.find_one(
        {
            "id": ws_id,
            "$or": [{"members.id": user["id"]}, {"is_public": True}, {"type": "promo"}],
        },
        {"_id": 0, "notes": 1},
    )
    if not ws:
        await websocket.close(code=4403)
        return
    room = rooms.get(ws_id) or rooms.setdefault(ws_id, Room(ws.get("notes", "")))
    room.clients[websocket] = {
        "id": user["id"],
        "name": user["name"],
        "avatar_v": user.get("avatar_v"),
    }
    await websocket.send_json(
        {"type": "init", "content": room.content, "version": room.version}
    )
    await room.broadcast({"type": "presence", "users": room.presence()})
    try:
        while True:
            msg = await websocket.receive_json()
            if msg.get("type") != "update":
                continue
            async with room.lock:
                before = room.content
                merged = room.apply(
                    int(msg.get("base_version", -1)), str(msg.get("content", ""))
                )
                if merged is None:
                    await websocket.send_json(
                        {
                            "type": "init",
                            "content": room.content,
                            "version": room.version,
                        }
                    )
                    continue
                version = room.version
                await websocket.send_json(
                    {"type": "ack", "content": merged, "version": version}
                )
                await room.broadcast(
                    {
                        "type": "sync",
                        "content": merged,
                        "version": version,
                        "by": user["name"],
                        "user_id": user["id"],
                    },
                    exclude=websocket,
                )
                await db.workspaces.update_one(
                    {"id": ws_id},
                    {
                        "$set": {
                            "notes": merged,
                            "notes_updated_at": now_iso(),
                            "notes_updated_by": user["name"],
                        }
                    },
                )
                await record_words(ws_id, user, word_count(merged) - word_count(before))
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("live notes error: %s", exc)
    finally:
        room.clients.pop(websocket, None)
        if room.clients:
            await room.broadcast({"type": "presence", "users": room.presence()})
        else:
            rooms.pop(ws_id, None)
