from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import db, format_ensae_level, get_current_user, new_id, now_iso, public_user

router = APIRouter(prefix="/api/tutoring")


class TutoringRequestIn(BaseModel):
    subject: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(default="", max_length=1200)
    preferred_date: str = ""
    mode: str = "visio"
    slot_label: str = ""
    target_tutor_id: str | None = None


class SlotsIn(BaseModel):
    slots: list[str] = Field(default=[], max_length=20)


class AcceptRequestIn(BaseModel):
    scheduled_at: str = ""
    note: str = ""


class RateRequestIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    review: str = Field(default="", max_length=600)


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


@router.put("/slots")
async def update_my_slots(body: SlotsIn, user: dict = Depends(get_current_user)):
    slots = [s.strip() for s in body.slots if s.strip()]
    await db.users.update_one({"id": user["id"]}, {"$set": {"tutor_slots": slots}})
    return {"tutor_slots": slots}


@router.get("/tutors")
async def list_tutors(
    subject: str = "",
    class_name: str = "",
    user: dict = Depends(get_current_user),
):
    flt: dict = {"is_tutor": True, "role": {"$ne": "admin"}}
    if subject:
        flt["tutor_subjects"] = subject
    if class_name:
        flt["class_name"] = class_name
    tutors = await db.users.find(flt, {"_id": 0, "password_hash": 0}).to_list(200)
    out = []
    for t in tutors:
        sessions = await db.tutoring_requests.find(
            {"tutor_id": t["id"], "status": "completed"}, {"_id": 0, "rating": 1}
        ).to_list(200)
        ratings = [s["rating"] for s in sessions if s.get("rating")]
        thanks_count = await db.tutor_thanks.count_documents({"tutor_id": t["id"]})
        thanked_by_me = bool(
            await db.tutor_thanks.find_one({"tutor_id": t["id"], "student_id": user["id"]})
        )
        pu = public_user(t)
        pu["completed_sessions"] = len(sessions)
        avg_r = round(sum(ratings) / len(ratings), 1) if ratings else None
        pu["avg_rating"] = avg_r
        pu["review_count"] = len(ratings)
        pu["thanks_count"] = thanks_count
        pu["thanked_by_me"] = thanked_by_me
        # Matching score
        t_subjects = [s.lower() for s in (t.get("tutor_subjects") or [])]
        matched = []
        for w in user.get("weaknesses") or []:
            wl = w.lower()
            if any(wl in ts or ts in wl for ts in t_subjects):
                matched.append(w)
        score = len(matched) * 35
        if subject and any(subject.lower() in ts for ts in t_subjects):
            score += 25
        score = min(100, score) if matched else 0
        pu["match_score"] = score
        pu["matched_weaknesses"] = matched
        out.append(pu)
    out.sort(
        key=lambda x: (x["match_score"], x["completed_sessions"], x["avg_rating"] or 0),
        reverse=True,
    )
    return out


@router.get("/requests")
async def list_requests(
    status: str = "",
    subject: str = "",
    filiere: str = "",
    mine: bool = False,
    user: dict = Depends(get_current_user),
):
    flt: dict = {}
    if status:
        flt["status"] = status
    if subject:
        flt["subject"] = subject
    if filiere:
        flt["student_filiere"] = filiere.strip().upper()
    if mine:
        flt["$or"] = [{"student_id": user["id"]}, {"tutor_id": user["id"]}]
    return (
        await db.tutoring_requests.find(flt, {"_id": 0})
        .sort("created_at", -1)
        .to_list(200)
    )


@router.post("/requests")
async def create_request(
    body: TutoringRequestIn, user: dict = Depends(get_current_user)
):
    req = {
        "id": new_id(),
        "student_id": user["id"],
        "student_name": user["name"],
        "student_filiere": user.get("filiere", ""),
        "student_annee": user.get("annee"),
        "student_level": format_ensae_level(user.get("filiere"), user.get("annee")),
        "subject": body.subject.strip(),
        "title": body.title.strip(),
        "description": body.description.strip(),
        "preferred_date": body.preferred_date.strip(),
        "mode": body.mode if body.mode in ("visio", "presentiel") else "visio",
        "slot_label": body.slot_label.strip(),
        "target_tutor_id": body.target_tutor_id,
        "status": "open",
        "tutor_id": None,
        "tutor_name": "",
        "tutor_level": "",
        "scheduled_at": body.preferred_date.strip(),
        "tutor_note": "",
        "rating": None,
        "review": "",
        "created_at": now_iso(),
        "accepted_at": None,
        "completed_at": None,
        "rated_at": None,
    }
    await db.tutoring_requests.insert_one(dict(req))

    from notification_routes import notify

    if body.target_tutor_id and body.target_tutor_id != user["id"]:
        await notify(
            body.target_tutor_id,
            f"tutor_req:{req['id']}:{body.target_tutor_id}",
            "tutoring_request",
            "Nouvelle demande de tutorat ciblée",
            f"{user['name']} ({req['student_level'] or 'ENSAE'}) cherche de l'aide en {req['subject']} : « {req['title']} ».",
            "/tutorat",
        )
    else:
        matching_tutors = await db.users.find(
            {
                "is_tutor": True,
                "id": {"$ne": user["id"]},
                "tutor_subjects": req["subject"],
            },
            {"_id": 0, "id": 1},
        ).to_list(50)
        if not matching_tutors:
            matching_tutors = await db.users.find(
                {"is_tutor": True, "id": {"$ne": user["id"]}},
                {"_id": 0, "id": 1},
            ).to_list(20)
        for t in matching_tutors:
            await notify(
                t["id"],
                f"tutor_req:{req['id']}:{t['id']}",
                "tutoring_request",
                f"Besoin d'aide en {req['subject']}",
                f"{user['name']} ({req['student_level'] or 'ENSAE'}) : « {req['title']} ».",
                "/tutorat",
            )
    return req


@router.post("/requests/{req_id}/accept")
async def accept_request(
    req_id: str,
    body: AcceptRequestIn | None = None,
    user: dict = Depends(get_current_user),
):
    req = await db.tutoring_requests.find_one({"id": req_id}, {"_id": 0})
    if not req:
        raise HTTPException(404, "Demande de tutorat introuvable")
    if req["status"] != "open":
        raise HTTPException(400, "Cette demande a déjà été prise en charge")
    if req["student_id"] == user["id"]:
        raise HTTPException(400, "Tu ne peux pas accepter ta propre demande")
    scheduled = (body.scheduled_at.strip() if body else "") or req.get(
        "preferred_date", ""
    )
    note = body.note.strip() if body else ""
    updates = {
        "status": "accepted",
        "tutor_id": user["id"],
        "tutor_name": user["name"],
        "tutor_filiere": user.get("filiere", ""),
        "tutor_annee": user.get("annee"),
        "tutor_level": format_ensae_level(user.get("filiere"), user.get("annee")),
        "scheduled_at": scheduled,
        "tutor_note": note,
        "accepted_at": now_iso(),
    }
    await db.tutoring_requests.update_one({"id": req_id}, {"$set": updates})

    from notification_routes import notify

    await notify(
        req["student_id"],
        f"tutor_accept:{req_id}:{user['id']}",
        "tutoring_accepted",
        "Un tuteur a accepté ta demande !",
        f"{user['name']} ({updates['tutor_level'] or 'Tuteur'}) t'accompagne en {req['subject']}.",
        "/tutorat",
    )
    return {**req, **updates}


@router.post("/requests/{req_id}/complete")
async def complete_request(req_id: str, user: dict = Depends(get_current_user)):
    req = await db.tutoring_requests.find_one({"id": req_id}, {"_id": 0})
    if not req:
        raise HTTPException(404, "Demande introuvable")
    if user["id"] not in (req["student_id"], req.get("tutor_id")):
        raise HTTPException(403, "Non autorisé")
    if req["status"] not in ("accepted", "completed"):
        raise HTTPException(400, "La session doit d'abord être acceptée par un tuteur")
    if req["status"] == "completed":
        return req
    updates = {"status": "completed", "completed_at": now_iso()}
    await db.tutoring_requests.update_one({"id": req_id}, {"$set": updates})

    from notification_routes import notify

    await notify(
        req["student_id"],
        f"tutor_complete:{req_id}",
        "tutoring_accepted",
        "Session terminée — note ton tuteur",
        f"Ta session de {req['subject']} avec {req['tutor_name']} est terminée. Laisse une note !",
        "/tutorat",
    )
    return {**req, **updates}


@router.post("/requests/{req_id}/rate")
async def rate_request(
    req_id: str, body: RateRequestIn, user: dict = Depends(get_current_user)
):
    req = await db.tutoring_requests.find_one({"id": req_id}, {"_id": 0})
    if not req:
        raise HTTPException(404, "Demande introuvable")
    if req["student_id"] != user["id"]:
        raise HTTPException(403, "Seul l'étudiant demandeur peut noter le tuteur")
    if req["status"] not in ("accepted", "completed") or not req.get("tutor_id"):
        raise HTTPException(400, "Impossible de noter une session sans tuteur")
    updates = {
        "status": "completed",
        "completed_at": req.get("completed_at") or now_iso(),
        "rating": body.rating,
        "review": body.review.strip(),
        "rated_at": now_iso(),
    }
    await db.tutoring_requests.update_one({"id": req_id}, {"$set": updates})

    from notification_routes import notify

    await notify(
        req["tutor_id"],
        f"tutor_rated:{req_id}",
        "badge",
        f"Nouvelle évaluation : {body.rating}/5 ★",
        f"{user['name']} t'a attribué {body.rating}/5 pour la session de {req['subject']}.",
        "/tutorat",
    )
    return {**req, **updates}


@router.post("/requests/{req_id}/cancel")
async def cancel_request(req_id: str, user: dict = Depends(get_current_user)):
    req = await db.tutoring_requests.find_one({"id": req_id}, {"_id": 0})
    if not req:
        raise HTTPException(404, "Demande introuvable")
    if user["id"] not in (req["student_id"], req.get("tutor_id")):
        raise HTTPException(403, "Non autorisé")
    await db.tutoring_requests.update_one(
        {"id": req_id}, {"$set": {"status": "cancelled"}}
    )
    return {**req, "status": "cancelled"}


@router.get("/requests/{req_id}/messages")
async def list_messages(req_id: str, user: dict = Depends(get_current_user)):
    req = await db.tutoring_requests.find_one({"id": req_id}, {"_id": 0})
    if not req:
        raise HTTPException(404, "Session introuvable")
    if user["id"] not in (req["student_id"], req.get("tutor_id")):
        raise HTTPException(403, "Accès réservé aux participants")
    return (
        await db.tutoring_messages.find({"request_id": req_id}, {"_id": 0})
        .sort("created_at", 1)
        .to_list(200)
    )


@router.post("/requests/{req_id}/messages")
async def send_message(
    req_id: str, body: MessageIn, user: dict = Depends(get_current_user)
):
    req = await db.tutoring_requests.find_one({"id": req_id}, {"_id": 0})
    if not req:
        raise HTTPException(404, "Session introuvable")
    if user["id"] not in (req["student_id"], req.get("tutor_id")):
        raise HTTPException(403, "Accès réservé aux participants")
    msg = {
        "id": new_id(),
        "request_id": req_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "text": body.text.strip(),
        "created_at": now_iso(),
    }
    await db.tutoring_messages.insert_one(dict(msg))
    return msg


@router.post("/tutors/{tutor_id}/thank")
async def thank_tutor(tutor_id: str, user: dict = Depends(get_current_user)):
    if tutor_id == user["id"]:
        raise HTTPException(400, "Tu ne peux pas te remercier toi-même")
    existing = await db.tutor_thanks.find_one(
        {"tutor_id": tutor_id, "student_id": user["id"]}
    )
    if existing:
        await db.tutor_thanks.delete_one({"_id": existing["_id"]})
        thanked = False
    else:
        await db.tutor_thanks.insert_one(
            {
                "id": new_id(),
                "tutor_id": tutor_id,
                "student_id": user["id"],
                "created_at": now_iso(),
            }
        )
        thanked = True
    count = await db.tutor_thanks.count_documents({"tutor_id": tutor_id})
    return {"thanked": thanked, "thanks_count": count}
