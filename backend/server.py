import asyncio
import logging
import os
from contextlib import suppress

from fastapi import FastAPI
from pymongo import ASCENDING, DESCENDING, IndexModel, TEXT
from starlette.middleware.cors import CORSMiddleware

from core import client, db, init_storage, logger
import ai_routes
import auth_routes
import chat_routes
import feed_routes
import library_routes
import live_notes
import moderation_routes
import notification_routes
import profile_routes
import tutoring_routes
import workspace_routes
from seed import run_seed

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        IndexModel([("email", ASCENDING)], name="email", unique=True),
        IndexModel([("id", ASCENDING)], name="id", unique=True),
    ],
    "login_attempts": [IndexModel([("identifier", ASCENDING)], name="identifier")],
    "password_reset_tokens": [
        IndexModel([("token_hash", ASCENDING)], name="token_hash", unique=True),
        IndexModel([("email", ASCENDING)], name="email"),
        IndexModel([("expires_at", ASCENDING)], name="expires"),
    ],
    "documents": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel(
            [("is_deleted", ASCENDING), ("updated_at", DESCENDING)], name="list"
        ),
        IndexModel(
            [
                ("title", TEXT),
                ("description", TEXT),
                ("concepts", TEXT),
                ("tags", TEXT),
                ("text_content", TEXT),
            ],
            name="fulltext",
            default_language="french",
            weights={
                "title": 10,
                "concepts": 6,
                "tags": 5,
                "description": 4,
                "text_content": 1,
            },
        ),
    ],
    "files": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "comments": [
        IndexModel(
            [("document_id", ASCENDING), ("created_at", DESCENDING)], name="doc"
        ),
        IndexModel([("id", ASCENDING)], name="id", unique=True),
    ],
    "workspaces": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("members.id", ASCENDING)], name="members"),
        IndexModel([("invite_code", ASCENDING)], name="invite_code"),
    ],
    "binomes": [
        IndexModel([("workspace_id", ASCENDING), ("created_at", DESCENDING)], name="ws")
    ],
    "tasks": [
        IndexModel([("workspace_id", ASCENDING), ("created_at", ASCENDING)], name="ws"),
        IndexModel(
            [("assignee_id", ASCENDING), ("status", ASCENDING)], name="assignee"
        ),
        IndexModel([("completed_by_id", ASCENDING)], name="completed_by"),
        IndexModel([("id", ASCENDING)], name="id", unique=True),
    ],
    "resources": [
        IndexModel([("workspace_id", ASCENDING), ("created_at", DESCENDING)], name="ws")
    ],
    "activities": [
        IndexModel(
            [("workspace_id", ASCENDING), ("created_at", DESCENDING)], name="ws"
        ),
        IndexModel(
            [("workspace_id", ASCENDING), ("user_id", ASCENDING), ("type", ASCENDING)],
            name="ws_user",
        ),
    ],
    "tutoring_requests": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status"),
    ],
    "tutoring_messages": [
        IndexModel([("request_id", ASCENDING), ("created_at", ASCENDING)], name="req")
    ],
    "forum_posts": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("created_at", DESCENDING)], name="recent"),
    ],
    "notifications": [
        IndexModel(
            [("user_id", ASCENDING), ("key", ASCENDING)], name="user_key", unique=True
        ),
        IndexModel(
            [("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_recent"
        ),
    ],
    "exams": [
        IndexModel([("user_id", ASCENDING), ("date", ASCENDING)], name="user_date")
    ],
    "study_plans": [
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user")
    ],
    "direct_messages": [
        IndexModel([("sender_id", ASCENDING), ("recipient_id", ASCENDING), ("created_at", ASCENDING)], name="dm_pair")
    ],
    "workspace_messages": [
        IndexModel([("workspace_id", ASCENDING), ("created_at", ASCENDING)], name="ws_chat")
    ],
    "reports": [
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status")
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.warning(
                    "ensure_indexes(%s.%s): %s", collection, model.document["name"], exc
                )


app = FastAPI(title="StudyHub ENSAE")
for r in (
    auth_routes.router,
    library_routes.router,
    ai_routes.router,
    tutoring_routes.router,
    workspace_routes.router,
    workspace_routes.forum_router,
    chat_routes.router,
    feed_routes.router,
    moderation_routes.router,
    notification_routes.router,
    profile_routes.router,
    live_notes.router,
):
    app.include_router(r)


@app.get("/api/")
async def root():
    from core import GEMINI_API_KEY, GEMINI_MODEL, _cloudinary_creds

    return {
        "message": "StudyHub ENSAE API",
        "status": "ok",
        "ai_configured": bool(
            GEMINI_API_KEY and GEMINI_API_KEY != "your_free_gemini_api_key_here"
        ),
        "ai_model": GEMINI_MODEL,
        "cloudinary_configured": _cloudinary_creds() is not None,
        "smtp_configured": bool(
            os.environ.get("SMTP_HOST", "").strip()
            and os.environ.get("SMTP_USER", "").strip()
            and os.environ.get("SMTP_PASSWORD", "").strip()
        ),
    }


cors_origins = [
    o.strip().rstrip("/")
    for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]
frontend_url = os.environ.get("FRONTEND_URL", "").strip().rstrip("/")
if frontend_url and frontend_url not in cors_origins:
    cors_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://[a-zA-Z0-9-]+\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)


async def startup_tasks():
    await ensure_indexes()
    try:
        await asyncio.to_thread(init_storage)
        logger.info("Local storage initialized")
    except Exception as exc:
        logger.error("Storage init failed: %s", exc)
    await run_seed()


@app.on_event("startup")
async def startup():
    app.state.startup_task = asyncio.create_task(startup_tasks())


@app.on_event("shutdown")
async def shutdown():
    if hasattr(app.state, "startup_task"):
        app.state.startup_task.cancel()
        with suppress(asyncio.CancelledError):
            await app.state.startup_task
    client.close()
