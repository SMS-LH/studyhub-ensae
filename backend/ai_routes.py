import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core import (
    ask_json,
    db,
    friendly_gemini_error,
    get_current_user,
    logger,
    new_id,
    now_iso,
    stream_llm,
)

router = APIRouter(prefix="/api/ai")
MAX_CHARS = 80000


class SourceIn(BaseModel):
    document_id: str | None = None
    text: str | None = None


async def source_text(src: SourceIn) -> tuple[str, str]:
    if src.document_id:
        doc = await db.documents.find_one(
            {"id": src.document_id, "is_deleted": False}, {"_id": 0}
        )
        if not doc:
            raise HTTPException(404, "Fiche introuvable")
        text = doc.get("text_content", "")
        if not text:
            raise HTTPException(
                400,
                "Aucun texte exploitable dans ce document (vidéo ou fichier scanné).",
            )
        return text[:MAX_CHARS], doc["title"]
    text = (src.text or "").strip()
    if len(text) < 30:
        raise HTTPException(
            400, "Colle un texte de cours plus long ou choisis une fiche."
        )
    return text[:MAX_CHARS], "Texte collé"


@router.post("/summary")
async def summary(body: SourceIn, user: dict = Depends(get_current_user)):
    text, title = await source_text(body)
    system = (
        "Tu es un professeur agrégé / tuteur senior à l'ENSAE (Statistiques, Probabilités, Économétrie, "
        "Macroéconomie, Microéconomie, Data Science, R/Python). À partir du cours fourni, rédige une fiche de révision "
        "rigoureuse en Markdown : titre, ## Idées clés, ## Définitions & théorèmes essentiels (avec hypothèses exactes), "
        "## Plan détaillé, ## Exemples / applications R ou Python & tests statistiques (Student, Chi-2, Fisher, MCO...), "
        "## Points de vigilance pour le partiel, ## Moyens mnémotechniques. "
        "Sois précis et concis. N'utilise jamais de LaTeX ni de symboles $ : écris les formules en texte simple ou Unicode (ex. β̂ = (X'X)⁻¹ X'y, H₀ : β = 0, σ²)."
    )

    async def gen():
        try:
            async for chunk in stream_llm(f"Cours ENSAE : {title}\n\n{text}", system):
                yield f"data: {json.dumps({'delta': chunk})}\n\n"
        except Exception as exc:
            logger.error("summary stream failed: %s", exc)
            yield f"data: {json.dumps({'error': friendly_gemini_error(exc)})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class DebugIn(BaseModel):
    code: str
    language: str = "Auto"
    error_message: str = ""


@router.post("/debug")
async def debug_code(body: DebugIn, user: dict = Depends(get_current_user)):
    if len(body.code.strip()) < 5:
        raise HTTPException(400, "Colle le code R, Python, Stata ou SAS à déboguer")
    return await ask_json(
        f"Langage : {body.language}\nMessage d'erreur : {body.error_message.strip() or 'Non précisé'}\n\nCode :\n{body.code[:25000]}",
        "Tu es un assistant pédagogique expert en programmation scientifique à l'ENSAE "
        "(R / tidyverse / lm / ggplot2, Python / pandas / numpy / statsmodels / scikit-learn, Stata .do, SAS). "
        "Tu dois déboguer le script de l'étudiant et expliquer clairement l'erreur. "
        'Renvoie {"diagnosis": "résumé court du bug", "explanation": "explication pédagogique détaillée en français", '
        '"fixed_code": "code complet corrigé et prêt à exécuter", "tips": ["2 à 4 bonnes pratiques ENSAE"]}.',
    )


class QuizIn(SourceIn):
    count: int = 8
    difficulty: str = "moyen"


@router.post("/quiz")
async def quiz(body: QuizIn, user: dict = Depends(get_current_user)):
    text, title = await source_text(body)
    count = max(3, min(body.count, 20))
    data = await ask_json(
        f"Crée {count} QCM de difficulté « {body.difficulty} » sur ce cours ENSAE ({title}) :\n\n{text}",
        "Tu crées des QCM exigeants de niveau ENSAE (Statistique, Probabilités, Économétrie, Micro/Macroéconomie, "
        'Data Science, R/Python) en français. Format : {"title": "...", "questions": [{"question": "...", '
        '"options": [4 propositions], "answer_index": 0-3, "explanation": "justification rigoureuse"}]}.',
    )
    qs = [q for q in data.get("questions", []) if len(q.get("options", [])) >= 2]
    return {"title": data.get("title", title), "questions": qs}


class FlashIn(SourceIn):
    count: int = 12


@router.post("/flashcards")
async def flashcards(body: FlashIn, user: dict = Depends(get_current_user)):
    text, title = await source_text(body)
    count = max(4, min(body.count, 30))
    data = await ask_json(
        f"Crée {count} flashcards sur ce cours ENSAE ({title}) :\n\n{text}",
        "Tu crées des cartes de révision recto/verso en français adaptées à l'ENSAE "
        "(théorèmes, lois de probabilité, hypothèses de modèles économétriques, fonctions R/Python). "
        'Format : {"title": "...", "cards": [{"front": "...", "back": "..."}]}.',
    )
    return {"title": data.get("title", title), "cards": data.get("cards", [])}


class CorrectIn(BaseModel):
    text: str
    mode: str = "correct"


MODES = {
    "correct": "Corrige uniquement l'orthographe, la grammaire, la conjugaison et la ponctuation, sans changer le style.",
    "style": "Corrige les fautes ET améliore le style pour un mémoire ou rapport statistique ENSAE : rigueur, clarté, fluidité, connecteurs logiques.",
    "rephrase": "Reformule entièrement le texte avec d'autres mots en gardant le sens, dans un style académique et scientifique.",
}


@router.post("/correct")
async def correct(body: CorrectIn, user: dict = Depends(get_current_user)):
    if len(body.text.strip()) < 3:
        raise HTTPException(400, "Saisis un texte à corriger")
    instruction = MODES.get(body.mode, MODES["correct"])
    return await ask_json(
        f"Texte :\n{body.text[:20000]}",
        f'Tu es un correcteur académique français. {instruction} Format : {{"corrected": "texte final", '
        '"changes": [{"original": "...", "correction": "...", "explanation": "..."}] (max 15 changements '
        'les plus importants), "comment": "bilan en une phrase"}.',
    )


class CitationIn(BaseModel):
    source_type: str = "livre"
    fields: dict = {}
    free_text: str = ""


@router.post("/citation")
async def citation(body: CitationIn, user: dict = Depends(get_current_user)):
    info = body.free_text.strip() or json.dumps(body.fields, ensure_ascii=False)
    if len(info) < 5:
        raise HTTPException(400, "Renseigne les informations de la source")
    return await ask_json(
        f"Type de source : {body.source_type}\nInformations : {info}",
        "Tu génères des références bibliographiques conformes aux normes APA 7e édition (adaptation française : "
        '« et », « p. », « (s. d.) »). Format : {"reference": "référence complète pour la bibliographie", '
        '"in_text": "citation dans le texte, ex. (Dupont, 2020)", "in_text_narrative": "ex. Dupont (2020)", '
        '"missing": ["informations manquantes à compléter"]}. Utilise *italique* en Markdown pour les titres.',
    )


class Exam(BaseModel):
    subject: str
    date: str
    difficulty: str = "moyen"


class PlanIn(BaseModel):
    exams: list[Exam]
    hours_per_day: float = 3
    start_date: str | None = None
    rest_days: list[str] = []


@router.post("/plan")
async def plan(body: PlanIn, user: dict = Depends(get_current_user)):
    if not body.exams:
        raise HTTPException(400, "Ajoute au moins un examen")
    start = body.start_date or date.today().isoformat()
    exams = [e.model_dump() for e in body.exams]
    if any(e["date"] < start for e in exams):
        raise HTTPException(
            400, "Les dates d'examen doivent être postérieures à la date de début"
        )
    data = await ask_json(
        f"Date de début : {start}\nHeures disponibles par jour : {body.hours_per_day}\n"
        f"Jours de repos souhaités : {', '.join(body.rest_days) or 'aucun'}\nExamens ENSAE : {json.dumps(exams, ensure_ascii=False)}",
        "Tu es un coach de révision pour les partiels de l'ENSAE (Économétrie, Micro-économie, Macro-économie, "
        "Probabilités, Statistique inférentielle, Séries temporelles, Sondages, R/Python). "
        "Crée un rétroplanning jour par jour de la date de début jusqu'au dernier examen (inclus), en appliquant "
        "la répétition espacée, plus de temps aux matières difficiles, des séances d'annales et de TP R/Python, "
        'des révisions générales la veille des examens et des pauses. Format : {"overview": "stratégie en 2-3 phrases", '
        '"days": [{"date": "AAAA-MM-JJ", "focus": "thème du jour", "is_exam": false, "is_rest": false, '
        '"sessions": [{"subject": "...", "task": "activité précise", "duration_min": 60}]}], '
        '"tips": ["3 à 5 conseils ENSAE"]}.',
    )
    from notification_routes import upsert_exam

    for e in exams:
        await upsert_exam(user["id"], e["subject"], e["date"], e["difficulty"])
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "input": body.model_dump(),
        "result": data,
        "created_at": now_iso(),
    }
    await db.study_plans.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.get("/plan")
async def latest_plan(user: dict = Depends(get_current_user)):
    return await db.study_plans.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
