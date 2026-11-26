from core import ENSAE_FILIERES, db, logger, new_id, now_iso


async def seed_promo_workspaces():
    """Crée uniquement les 8 espaces publics structurels des promotions ENSAE (sans données fictives)."""
    if await db.workspaces.count_documents({"type": "promo"}) > 0:
        return
    for filiere, years in ENSAE_FILIERES.items():
        for annee in years:
            name = f"{filiere} {annee}"
            await db.workspaces.insert_one(
                {
                    "id": new_id(),
                    "name": f"Amphi Virtuel {name}",
                    "description": f"Espace public de la promotion {name}.",
                    "subject": f"Promotion {name}",
                    "type": "promo",
                    "is_public": True,
                    "filiere": filiere,
                    "annee": annee,
                    "owner_id": "system",
                    "members": [],
                    "invite_code": f"{filiere}{annee}ENSAE",
                    "notes": "",
                    "notes_updated_at": now_iso(),
                    "notes_updated_by": "",
                    "created_at": now_iso(),
                }
            )
    logger.info("Initialized empty ENSAE promo workspaces")


async def run_seed():
    try:
        await seed_promo_workspaces()
    except Exception as exc:
        logger.error("Seed failed: %s", exc)
