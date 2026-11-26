from core import ENSAE_CLASSES, db, logger, new_id, now_iso


async def seed_promo_workspaces():
    """Crée les 10 espaces publics des classes ENSAE (sans données fictives)."""
    for cls in ENSAE_CLASSES:
        existing = await db.workspaces.find_one({"type": "promo", "class_name": cls})
        if existing:
            continue
        code = "".join(c for c in cls.upper() if c.isalnum()) + "ENSAE"
        await db.workspaces.insert_one(
            {
                "id": new_id(),
                "name": f"Amphi Virtuel {cls}",
                "description": f"Espace public de la classe {cls}.",
                "subject": f"Classe {cls}",
                "type": "promo",
                "is_public": True,
                "class_name": cls,
                "class_label": cls,
                "owner_id": "system",
                "members": [],
                "invite_code": code,
                "notes": "",
                "notes_updated_at": now_iso(),
                "notes_updated_by": "",
                "created_at": now_iso(),
            }
        )
    logger.info("Ensured ENSAE class promo workspaces")


async def run_seed():
    try:
        await seed_promo_workspaces()
    except Exception as exc:
        logger.error("Seed failed: %s", exc)
