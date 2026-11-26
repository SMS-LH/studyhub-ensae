from core import db

RECOGNITION_BADGES = [
    (
        "premier_partage",
        "Premier partage",
        "Partager sa première fiche ou script",
        "docs_shared",
        1,
        "upload",
    ),
    (
        "data_master",
        "Data Master",
        "Partager 3 scripts R, Python, Stata ou SAS",
        "code_docs_shared",
        3,
        "code",
    ),
    (
        "chasseur_annales",
        "Transmission d'Annales",
        "Partager au moins 1 annale d'examen",
        "annales_shared",
        1,
        "filecheck",
    ),
    (
        "tuteur_actif",
        "Tuteur engagé",
        "Aider au moins 1 camarade en tutorat",
        "tutoring_sessions_completed",
        1,
        "graduation",
    ),
    (
        "esprit_equipe",
        "Esprit de promo",
        "Participer activement à l'entraide de classe",
        "comments",
        3,
        "users",
    ),
]


async def compute_stats(user_id: str) -> dict:
    own = {"author_id": user_id, "is_deleted": False}
    stats = {
        "docs_shared": await db.documents.count_documents(own),
        "code_docs_shared": await db.documents.count_documents({**own, "format": "code"}),
        "annales_shared": await db.documents.count_documents({**own, "is_annale": True}),
        "docs_validated": await db.documents.count_documents(
            {"validated_by_id": user_id, "is_deleted": False}
        ),
        "tutoring_sessions_completed": await db.tutoring_requests.count_documents(
            {"tutor_id": user_id, "status": "completed"}
        ),
        "thanks_received": await db.tutor_thanks.count_documents({"tutor_id": user_id}),
        "comments": await db.comments.count_documents({"author_id": user_id}),
        "tasks_completed": await db.tasks.count_documents(
            {"assignee_id": user_id, "status": "done"}
        ),
    }
    badges = [
        {
            "id": bid,
            "name": name,
            "desc": desc,
            "icon": icon,
            "unlocked": stats.get(metric, 0) >= target,
            "progress": min(stats.get(metric, 0), target),
            "target": target,
        }
        for bid, name, desc, metric, target, icon in RECOGNITION_BADGES
    ]
    return {"stats": stats, "badges": badges}
