from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import db, format_ensae_level, get_current_user, new_id, now_iso, public_user

router = APIRouter(prefix="/api")


def require_moderator(user: dict):
    if user.get("role") not in ("moderator", "admin", "class_admin"):
        raise HTTPException(403, "Réservé aux délégués de classe et modérateurs BDE")


class ReportIn(BaseModel):
    target_type: str = Field(pattern="^(document|forum_post|user)$")
    target_id: str = Field(min_length=1)
    reason: str = Field(min_length=2, max_length=100)
    details: str = Field(default="", max_length=600)


class ResolveReportIn(BaseModel):
    action: str = Field(pattern="^(dismiss|delete_content)$")
    note: str = Field(default="", max_length=300)


class RoleIn(BaseModel):
    role: str = Field(pattern="^(student|class_admin|moderator)$")


@router.post("/reports")
async def create_report(body: ReportIn, user: dict = Depends(get_current_user)):
    target_title = body.target_id
    if body.target_type == "document":
        doc = await db.documents.find_one({"id": body.target_id}, {"_id": 0, "title": 1})
        if not doc:
            raise HTTPException(404, "Fiche introuvable")
        target_title = doc.get("title", "")
    elif body.target_type == "forum_post":
        post = await db.forum_posts.find_one({"id": body.target_id}, {"_id": 0, "title": 1})
        if not post:
            raise HTTPException(404, "Sujet introuvable")
        target_title = post.get("title", "")
    elif body.target_type == "user":
        u = await db.users.find_one({"id": body.target_id}, {"_id": 0, "name": 1})
        if not u:
            raise HTTPException(404, "Étudiant introuvable")
        target_title = u.get("name", "")

    rep = {
        "id": new_id(),
        "target_type": body.target_type,
        "target_id": body.target_id,
        "target_title": target_title,
        "reason": body.reason.strip(),
        "details": body.details.strip(),
        "reporter_id": user["id"],
        "reporter_name": user["name"],
        "status": "open",
        "resolved_by": None,
        "resolution_action": "",
        "resolution_note": "",
        "created_at": now_iso(),
        "resolved_at": None,
    }
    await db.reports.insert_one(dict(rep))
    return rep


@router.get("/moderation/reports")
async def list_reports(
    status: str = "", user: dict = Depends(get_current_user)
):
    require_moderator(user)
    flt = {"status": status} if status else {}
    return (
        await db.reports.find(flt, {"_id": 0})
        .sort("created_at", -1)
        .to_list(200)
    )


@router.post("/moderation/reports/{report_id}/resolve")
async def resolve_report(
    report_id: str,
    body: ResolveReportIn,
    user: dict = Depends(get_current_user),
):
    require_moderator(user)
    rep = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not rep:
        raise HTTPException(404, "Signalement introuvable")

    if body.action == "delete_content":
        if rep["target_type"] == "document":
            await db.documents.update_one(
                {"id": rep["target_id"]}, {"$set": {"is_deleted": True}}
            )
        elif rep["target_type"] == "forum_post":
            await db.forum_posts.delete_one({"id": rep["target_id"]})

    await db.reports.update_one(
        {"id": report_id},
        {
            "$set": {
                "status": "resolved",
                "resolved_by": user["name"],
                "resolution_action": body.action,
                "resolution_note": body.note.strip(),
                "resolved_at": now_iso(),
            }
        },
    )
    return await db.reports.find_one({"id": report_id}, {"_id": 0})


@router.get("/moderation/users")
async def moderation_users(user: dict = Depends(get_current_user)):
    require_moderator(user)
    flt = {}
    if user.get("role") == "class_admin" and user.get("class_name"):
        flt["class_name"] = user["class_name"]
    users = (
        await db.users.find(flt, {"_id": 0, "password_hash": 0})
        .sort("created_at", -1)
        .to_list(300)
    )
    return [public_user(u) for u in users]


@router.post("/moderation/users/{user_id}/verify")
async def verify_user(
    user_id: str, approved: bool = True, user: dict = Depends(get_current_user)
):
    require_moderator(user)
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Utilisateur introuvable")
    if user.get("role") == "class_admin" and target.get("class_name") != user.get("class_name"):
        raise HTTPException(403, "Tu ne peux valider que les étudiants de ta classe")
    status = "verified" if approved else "rejected"
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_verified": approved, "verification_status": status}},
    )
    return {"id": user_id, "is_verified": approved, "verification_status": status}


@router.post("/moderation/users/{user_id}/role")
async def update_user_role(
    user_id: str, body: RoleIn, user: dict = Depends(get_current_user)
):
    if user.get("role") not in ("moderator", "admin"):
        raise HTTPException(403, "Seul un modérateur BDE peut nommer un délégué ou modérateur")
    if user_id == user["id"] and body.role != "moderator":
        raise HTTPException(400, "Tu ne peux pas te retirer toi-même les droits")
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Utilisateur introuvable")
    await db.users.update_one({"id": user_id}, {"$set": {"role": body.role}})
    return {"id": user_id, "role": body.role}


@router.delete("/moderation/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") not in ("moderator", "admin"):
        raise HTTPException(403, "Seul un modérateur BDE peut supprimer un utilisateur")
    if user_id == user["id"]:
        raise HTTPException(400, "Tu ne peux pas supprimer ton propre compte")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "role": 1})
    if not target:
        raise HTTPException(404, "Utilisateur introuvable")
    if target.get("role") == "admin":
        raise HTTPException(403, "Impossible de supprimer un administrateur système")

    await db.users.delete_one({"id": user_id})
    await db.workspaces.update_many({}, {"$pull": {"members": {"id": user_id}}})
    await db.notifications.delete_many({"user_id": user_id})
    await db.password_reset_tokens.delete_many({"user_id": user_id})
    await db.exams.delete_many({"user_id": user_id})
    await db.study_plans.delete_many({"user_id": user_id})
    return {"ok": True, "id": user_id}


@router.get("/moderation/stats")
async def school_stats(user: dict = Depends(get_current_user)):
    require_moderator(user)
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    docs = await db.documents.find(
        {"is_deleted": False}, {"_id": 0, "subject": 1, "is_annale": 1, "format": 1}
    ).to_list(1000)
    completed_tutoring = await db.tutoring_requests.find(
        {"status": "completed"}, {"_id": 0, "tutor_id": 1, "tutor_name": 1, "rating": 1}
    ).to_list(500)
    open_reports = await db.reports.count_documents({"status": "open"})
    forum_count = await db.forum_posts.count_documents({})
    tutoring_open = await db.tutoring_requests.count_documents({"status": "open"})

    by_promo: dict[str, int] = {}
    verified_count = 0
    pending_count = 0
    tutors_count = 0
    for u in users:
        lvl = format_ensae_level(u.get("filiere"), u.get("annee")) or "Non renseigné"
        by_promo[lvl] = by_promo.get(lvl, 0) + 1
        if u.get("is_verified", True):
            verified_count += 1
        else:
            pending_count += 1
        if u.get("is_tutor"):
            tutors_count += 1

    subject_counts: dict[str, int] = {}
    annales_count = 0
    for d in docs:
        s = d.get("subject") or "Autre"
        subject_counts[s] = subject_counts.get(s, 0) + 1
        if d.get("is_annale"):
            annales_count += 1
    top_subjects = sorted(
        [{"subject": k, "count": v} for k, v in subject_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:6]

    tutor_map: dict[str, dict] = {}
    for s in completed_tutoring:
        tid = s.get("tutor_id")
        if not tid:
            continue
        entry = tutor_map.setdefault(
            tid, {"id": tid, "name": s.get("tutor_name", ""), "sessions": 0, "ratings": []}
        )
        entry["sessions"] += 1
        if s.get("rating"):
            entry["ratings"].append(s["rating"])
    top_tutors = sorted(
        [
            {
                "id": v["id"],
                "name": v["name"],
                "sessions": v["sessions"],
                "avg_rating": round(sum(v["ratings"]) / len(v["ratings"]), 1)
                if v["ratings"]
                else None,
            }
            for v in tutor_map.values()
        ],
        key=lambda x: x["sessions"],
        reverse=True,
    )[:5]

    return {
        "total_users": len(users),
        "verified_users": verified_count,
        "pending_users": pending_count,
        "tutors_count": tutors_count,
        "total_documents": len(docs),
        "annales_count": annales_count,
        "completed_tutoring": len(completed_tutoring),
        "open_tutoring": tutoring_open,
        "forum_posts": forum_count,
        "open_reports": open_reports,
        "by_promo": [{"promo": k, "count": v} for k, v in sorted(by_promo.items())],
        "top_subjects": top_subjects,
        "top_tutors": top_tutors,
    }
