from datetime import date, datetime
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import db, get_current_user, new_id, now_iso
from gamification import compute_stats

router = APIRouter(prefix="/api")
TZ = ZoneInfo("Europe/Paris")


def today() -> date:
    return datetime.now(TZ).date()


async def notify(
    user_id: str, key: str, type_: str, title: str, message: str, link: str = ""
):
    await db.notifications.update_one(
        {"user_id": user_id, "key": key},
        {
            "$setOnInsert": {
                "id": new_id(),
                "user_id": user_id,
                "key": key,
                "type": type_,
                "title": title,
                "message": message,
                "link": link,
                "read": False,
                "created_at": now_iso(),
            }
        },
        upsert=True,
    )


def _stage(days: int, stages: list[int]) -> str | None:
    if days < 0:
        return "overdue"
    for s in sorted(stages):
        if days <= s:
            return f"j{s}"
    return None


def _days(day: str, t: date) -> int | None:
    try:
        return (date.fromisoformat(day[:10]) - t).days
    except (ValueError, TypeError):
        return None


def _when(days: int) -> str:
    return (
        {0: "aujourd'hui", 1: "demain"}.get(days, f"dans {days} jours")
        if days >= 0
        else f"en retard de {-days} jour(s)"
    )


async def generate_reminders(user: dict):
    t = today()
    now_local = datetime.now(TZ)
    async for task in db.tasks.find(
        {
            "assignee_id": user["id"],
            "status": {"$ne": "done"},
            "due_date": {"$nin": [None, ""]},
        },
        {"_id": 0},
    ):
        days = _days(task["due_date"], t)
        stage = None if days is None else _stage(days, [0, 1, 3])
        if not stage:
            continue
        ws = await db.workspaces.find_one(
            {"id": task["workspace_id"]}, {"_id": 0, "name": 1}
        )
        await notify(
            user["id"],
            f"task:{task['id']}:{task['due_date']}:{stage}",
            "task_deadline",
            "Tâche en retard" if stage == "overdue" else "Rappel de deadline",
            f"« {task['title']} » ({ws['name'] if ws else 'espace'}) est à rendre {_when(days)}.",
            f"/espaces/{task['workspace_id']}",
        )
    async for exam in db.exams.find({"user_id": user["id"]}, {"_id": 0}):
        days = _days(exam["date"], t)
        if days is None or days < 0:
            continue
        stage = _stage(days, [0, 1, 3, 7])
        if stage:
            await notify(
                user["id"],
                f"exam:{exam['id']}:{exam['date']}:{stage}",
                "exam_reminder",
                "Examen à venir",
                f"Ton examen de {exam['subject']} a lieu {_when(days)}.",
                "/assistant?tool=planner",
            )
    async for sess in db.tutoring_requests.find(
        {
            "status": "accepted",
            "scheduled_at": {"$nin": [None, ""]},
            "$or": [{"student_id": user["id"]}, {"tutor_id": user["id"]}],
        },
        {"_id": 0},
    ):
        sched = sess.get("scheduled_at", "")
        days = _days(sched, t)
        if days is None or days < 0:
            continue
        # 1h reminder when an exact time is provided (YYYY-MM-DDTHH:MM)
        if "T" in sched:
            try:
                dt = datetime.fromisoformat(sched)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=TZ)
                mins = (dt - now_local).total_seconds() / 60
                if 0 <= mins <= 75:
                    await notify(
                        user["id"],
                        f"tutor_1h:{sess['id']}:{sched}",
                        "tutoring_reminder",
                        "Session de tutorat dans moins d'1h !",
                        f"Rappel : session de {sess['subject']} ({sess['title']}) prévue à {dt.strftime('%H:%M')}.",
                        "/tutorat",
                    )
            except ValueError:
                pass
        if days in (0, 1):
            await notify(
                user["id"],
                f"tutor_day:{sess['id']}:j{days}",
                "tutoring_reminder",
                "Rappel de session de tutorat",
                f"Session de {sess['subject']} avec {sess['tutor_name'] if user['id'] == sess['student_id'] else sess['student_name']} {_when(days)}.",
                "/tutorat",
            )


@router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    await generate_reminders(user)
    items = (
        await db.notifications.find({"user_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(50)
    )
    unread = await db.notifications.count_documents(
        {"user_id": user["id"], "read": False}
    )
    return {"items": items, "unread": unread}


@router.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False}, {"$set": {"read": True}}
    )
    return {"ok": True}


@router.post("/notifications/{nid}/read")
async def read_one(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": nid, "user_id": user["id"]}, {"$set": {"read": True}}
    )
    return {"ok": True}


@router.get("/deadlines")
async def deadlines(user: dict = Depends(get_current_user)):
    t = today()
    items = []
    async for task in db.tasks.find(
        {
            "assignee_id": user["id"],
            "status": {"$ne": "done"},
            "due_date": {"$nin": [None, ""]},
        },
        {"_id": 0},
    ):
        days = _days(task["due_date"], t)
        if days is None:
            continue
        ws = await db.workspaces.find_one(
            {"id": task["workspace_id"]}, {"_id": 0, "name": 1}
        )
        items.append(
            {
                "kind": "task",
                "id": task["id"],
                "title": task["title"],
                "context": ws["name"] if ws else "",
                "date": task["due_date"],
                "days": days,
                "link": f"/espaces/{task['workspace_id']}",
            }
        )
    async for exam in db.exams.find(
        {"user_id": user["id"], "date": {"$gte": t.isoformat()}}, {"_id": 0}
    ):
        items.append(
            {
                "kind": "exam",
                "id": exam["id"],
                "title": exam["subject"],
                "context": "Partiel ENSAE",
                "date": exam["date"],
                "days": _days(exam["date"], t),
                "link": "/assistant?tool=planner",
            }
        )
    async for sess in db.tutoring_requests.find(
        {
            "status": "accepted",
            "scheduled_at": {"$nin": [None, ""]},
            "$or": [{"student_id": user["id"]}, {"tutor_id": user["id"]}],
        },
        {"_id": 0},
    ):
        days = _days(sess["scheduled_at"], t)
        if days is None or days < 0:
            continue
        items.append(
            {
                "kind": "tutoring",
                "id": sess["id"],
                "title": f"Tutorat : {sess['subject']}",
                "context": sess["title"],
                "date": sess["scheduled_at"][:10],
                "days": days,
                "link": "/tutorat",
            }
        )
    return sorted(items, key=lambda i: i["date"])


class ExamIn(BaseModel):
    subject: str
    date: str
    difficulty: Literal["facile", "moyen", "difficile"] = "moyen"


async def upsert_exam(
    user_id: str, subject: str, day: str, difficulty: str = "moyen"
) -> dict:
    exam = await db.exams.find_one(
        {"user_id": user_id, "subject": subject.strip(), "date": day}, {"_id": 0}
    )
    if exam:
        return exam
    exam = {
        "id": new_id(),
        "user_id": user_id,
        "subject": subject.strip(),
        "date": day,
        "difficulty": difficulty,
        "created_at": now_iso(),
    }
    await db.exams.insert_one(dict(exam))
    return exam


@router.get("/exams")
async def list_exams(user: dict = Depends(get_current_user)):
    return (
        await db.exams.find({"user_id": user["id"]}, {"_id": 0})
        .sort("date", 1)
        .to_list(200)
    )


@router.post("/exams")
async def add_exam(body: ExamIn, user: dict = Depends(get_current_user)):
    if not body.subject.strip():
        raise HTTPException(400, "Indique la matière")
    try:
        date.fromisoformat(body.date)
    except ValueError:
        raise HTTPException(400, "Date invalide")
    return await upsert_exam(user["id"], body.subject, body.date, body.difficulty)


@router.delete("/exams/{exam_id}")
async def delete_exam(exam_id: str, user: dict = Depends(get_current_user)):
    await db.exams.delete_one({"id": exam_id, "user_id": user["id"]})
    return {"ok": True}
