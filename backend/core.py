from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import asyncio
import io
import json
import logging
import mimetypes
import os
import re
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException, Request
from google import genai
from google.genai import types
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger("studyhub")

USE_MOCK_DB = os.environ.get("USE_MOCK_DB", "").strip().lower() in ("1", "true", "yes")
DB_NAME = os.environ.get("DB_NAME", "studyhub_ensae")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")

if USE_MOCK_DB:
    from mongomock_motor import AsyncMongoMockClient

    client = AsyncMongoMockClient()
    logger.info("Using in-memory mongomock_motor database (%s)", DB_NAME)
else:
    client = AsyncIOMotorClient(MONGO_URL)

db = client[DB_NAME]

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
JWT_SECRET = os.environ.get("JWT_SECRET", "").strip() or "ensae-studyhub-dev-secret-key-2026"
APP_NAME = "studyhub"
MAX_UPLOAD = 100 * 1024 * 1024
STORAGE_DIR = Path(os.environ.get("STORAGE_DIR") or (ROOT_DIR / "storage")).resolve()

ENSAE_CLASSES: list[str] = [
    "ISEP1",
    "ISEP2",
    "ISE1-Cycle Long",
    "ISE1 Math",
    "ISE1 Eco",
    "ISE2",
    "ISE3",
    "AS1",
    "AS2",
    "AS3",
]

# Legacy compat kept for existing tutoring_routes code
ENSAE_FILIERES: dict[str, list[int]] = {
    "ISE": [1, 2, 3, 4, 5],
    "AS": [1, 2, 3],
}

ENSAE_SUBJECTS: list[str] = [
    "Probabilités",
    "Statistique mathématique",
    "Économétrie",
    "Macroéconomie",
    "Microéconomie",
    "Séries temporelles",
    "Machine Learning / Data Science",
    "Logiciel R",
    "Python / Data",
    "SAS / Stata",
    "Algèbre linéaire",
    "Sondages",
    "Démographie",
    "Comptabilité nationale",
    "Autre",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def word_count(text: str) -> int:
    return len(re.findall(r"\w+", text or ""))


# ---------- ENSAE Profile Validation ----------
def normalize_class(class_name: str | None) -> str:
    """Normalize and validate a class name against ENSAE_CLASSES."""
    cn = (class_name or "").strip()
    if not cn:
        return ""
    # Case-insensitive match
    for valid in ENSAE_CLASSES:
        if cn.lower() == valid.lower():
            return valid
    raise HTTPException(
        400,
        f"Classe invalide. Classes disponibles : {', '.join(ENSAE_CLASSES)}"
    )


def normalize_ensae_level(
    filiere: str | None, annee: int | str | None
) -> tuple[str, int | None]:
    fil = (filiere or "").strip().upper()
    if fil and fil not in ENSAE_FILIERES:
        raise HTTPException(400, "Filière invalide (choisis ISE ou AS)")
    yr: int | None = None
    if annee not in (None, "", 0, "0"):
        try:
            yr = int(annee)
        except (TypeError, ValueError):
            raise HTTPException(400, "Année invalide")
        if fil:
            allowed = ENSAE_FILIERES[fil]
            if yr not in allowed:
                raise HTTPException(
                    400,
                    f"Année invalide pour {fil} (attendu : {allowed[0]} à {allowed[-1]})",
                )
        elif yr not in (1, 2, 3, 4, 5):
            raise HTTPException(400, "Année invalide (1 à 5)")
    return fil, yr


def format_ensae_level(filiere: str | None, annee: int | None) -> str:
    if filiere and annee:
        return f"{filiere} {annee}"
    return filiere or ""


def is_senior_tutor(user: dict) -> bool:
    if user.get("role") == "admin":
        return True
    if not user.get("is_tutor"):
        return False
    fil = (user.get("filiere") or "").upper()
    yr = int(user.get("annee") or 0)
    return (fil == "ISE" and yr >= 3) or (fil == "AS" and yr >= 2)


# ---------- Auth ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(user_id: str, kind: str, delta: timedelta) -> str:
    payload = {"sub": user_id, "type": kind, "exp": datetime.now(timezone.utc) + delta}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


PROFILE_FIELDS = (
    "field",
    "year",
    "filiere",
    "annee",
    "bio",
    "interests",
    "skills",
    "weaknesses",
    "is_parallel_admission",
    "is_tutor",
    "tutor_subjects",
    "tutor_slots",
    "contact_info",
)


def public_user(u: dict) -> dict:
    out = {
        k: u.get(k)
        for k in ("id", "email", "name", "university", "role", "created_at")
    }
    if not out.get("university"):
        out["university"] = "ENSAE"
    class_name = u.get("class_name") or format_ensae_level(u.get("filiere"), u.get("annee")) or ""
    out.update(
        {
            "class_name": class_name,
            # Legacy fields kept for compat
            "field": u.get("field") or u.get("filiere") or "",
            "year": u.get("year") or class_name,
            "filiere": u.get("filiere") or "",
            "annee": u.get("annee"),
            "bio": u.get("bio") or "",
            "interests": u.get("interests") or [],
            "skills": u.get("skills") or [],
            "weaknesses": u.get("weaknesses") or [],
            "is_parallel_admission": bool(u.get("is_parallel_admission", False)),
            "is_tutor": bool(u.get("is_tutor", False)),
            "tutor_subjects": u.get("tutor_subjects") or [],
            "tutor_slots": u.get("tutor_slots") or [],
            "contact_info": u.get("contact_info") or "",
            "is_verified": bool(u.get("is_verified", True)),
            "verification_status": u.get("verification_status") or "verified",
        }
    )
    out["avatar_v"] = u.get("avatar_v")
    return out


async def user_from_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expirée")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Jeton invalide")
    if payload.get("type") != "access":
        raise HTTPException(401, "Jeton invalide")
    user = await db.users.find_one(
        {"id": payload["sub"]}, {"_id": 0, "password_hash": 0}
    )
    if not user:
        raise HTTPException(401, "Utilisateur introuvable")
    return user


async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if (
        not token
        and request.url.path.endswith(("/file", "/avatar"))
        and request.method == "GET"
    ):
        token = request.query_params.get("token")
    if not token:
        raise HTTPException(401, "Non authentifié")
    return await user_from_token(token)


# ---------- Local Object Storage ----------
def init_storage(force: bool = False) -> str:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    return str(STORAGE_DIR)


def _safe_storage_path(rel_path: str) -> Path:
    clean = rel_path.lstrip("/").replace("\\", "/")
    target = (STORAGE_DIR / clean).resolve()
    if STORAGE_DIR not in target.parents and target != STORAGE_DIR:
        raise HTTPException(400, "Chemin de stockage invalide")
    return target


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    def _write():
        init_storage()
        target = _safe_storage_path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return {"path": path, "size": len(data), "content_type": content_type}

    return await asyncio.to_thread(_write)


async def get_object(path: str) -> bytes:
    def _read():
        target = _safe_storage_path(path)
        if not target.exists():
            raise FileNotFoundError(path)
        return target.read_bytes()

    return await asyncio.to_thread(_read)


# ---------- Formats & text extraction ----------
CODE_EXTS = {
    "py",
    "js",
    "jsx",
    "ts",
    "tsx",
    "java",
    "c",
    "cpp",
    "h",
    "hpp",
    "cs",
    "go",
    "rs",
    "rb",
    "php",
    "sql",
    "r",
    "rmd",
    "qmd",
    "do",
    "sas",
    "jl",
    "m",
    "swift",
    "kt",
    "scala",
    "sh",
    "html",
    "css",
    "json",
    "ipynb",
    "tex",
}
TEXT_EXTS = {"txt", "md"}
DATA_EXTS = {"csv", "xlsx"}
FORMAT_BY_EXT = {
    "pdf": "pdf",
    "doc": "word",
    "docx": "word",
    "odt": "word",
    "ppt": "powerpoint",
    "pptx": "powerpoint",
    "odp": "powerpoint",
    "mp4": "video",
    "webm": "video",
    "mov": "video",
    "mkv": "video",
    "avi": "video",
    "m4v": "video",
}


def file_ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def detect_format(filename: str) -> str | None:
    ext = file_ext(filename)
    if ext in FORMAT_BY_EXT:
        return FORMAT_BY_EXT[ext]
    if ext in CODE_EXTS:
        return "code"
    if ext in DATA_EXTS:
        return "dataset"
    if ext in TEXT_EXTS:
        return "texte"
    return None


def guess_mime(filename: str, fallback: str | None) -> str:
    ext = file_ext(filename)
    if ext in CODE_EXTS or ext in TEXT_EXTS:
        return "text/plain; charset=utf-8"
    if ext == "csv":
        return "text/csv; charset=utf-8"
    if ext == "xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if ext == "mov":
        return "video/quicktime"
    return mimetypes.guess_type(filename)[0] or fallback or "application/octet-stream"


def extract_text(data: bytes, filename: str) -> str:
    ext = file_ext(filename)
    text = ""
    try:
        if ext == "pdf":
            import pypdf

            reader = pypdf.PdfReader(io.BytesIO(data))
            text = "\n\n".join((p.extract_text() or "") for p in reader.pages)
        elif ext == "docx":
            import docx

            d = docx.Document(io.BytesIO(data))
            parts = [p.text for p in d.paragraphs]
            for t in d.tables:
                for row in t.rows:
                    parts.append(" | ".join(c.text for c in row.cells))
            text = "\n".join(parts)
        elif ext == "pptx":
            from pptx import Presentation

            prs = Presentation(io.BytesIO(data))
            parts = []
            for i, slide in enumerate(prs.slides, 1):
                parts.append(f"--- Diapositive {i} ---")
                for shape in slide.shapes:
                    if shape.has_text_frame:
                        parts.append(shape.text_frame.text)
            text = "\n".join(parts)
        elif ext in CODE_EXTS or ext in TEXT_EXTS or ext == "csv":
            text = data.decode("utf-8", errors="ignore")
        elif ext == "xlsx":
            import xml.etree.ElementTree as ET
            import zipfile

            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                shared = []
                if "xl/sharedStrings.xml" in zf.namelist():
                    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
                    for si in root.iter():
                        if si.tag.endswith("}t") or si.tag == "t":
                            shared.append(si.text or "")
                rows = []
                for name in sorted(zf.namelist()):
                    if name.startswith("xl/worksheets/sheet") and name.endswith(".xml"):
                        sroot = ET.fromstring(zf.read(name))
                        for row_el in sroot.iter():
                            if row_el.tag.endswith("}row"):
                                vals = []
                                for c in row_el:
                                    t_attr = c.attrib.get("t", "")
                                    v_el = next((ch for ch in c if ch.tag.endswith("}v")), None)
                                    if v_el is not None and v_el.text is not None:
                                        if t_attr == "s" and v_el.text.isdigit():
                                            idx = int(v_el.text)
                                            vals.append(shared[idx] if idx < len(shared) else v_el.text)
                                        else:
                                            vals.append(v_el.text)
                                if vals:
                                    rows.append(" | ".join(vals))
                                if len(rows) >= 200:
                                    break
                text = "\n".join(rows)
    except Exception as exc:
        logger.warning("extract_text(%s) failed: %s", filename, exc)
    return text.strip()[:200000]


# ---------- LLM (Google Gemini gratuit via google-genai) ----------
def _gemini_client():
    if not GEMINI_API_KEY or GEMINI_API_KEY == "your_free_gemini_api_key_here":
        return None
    return genai.Client(api_key=GEMINI_API_KEY)


def parse_json(raw: str):
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
    start = min(
        [i for i in (cleaned.find("{"), cleaned.find("[")) if i >= 0], default=0
    )
    end = max(cleaned.rfind("}"), cleaned.rfind("]"))
    return json.loads(cleaned[start : end + 1])


def _demo_json_fallback(prompt: str, system: str):
    """Mode démo hors-ligne si GEMINI_API_KEY n'est pas encore configurée."""
    s = system.lower()
    if "index" in s or "concepts" in s:
        return {
            "concepts": [
                "Inférence statistique",
                "Modèle linéaire (MCO)",
                "Test d'hypothèse",
                "Analyse sous R / Python",
            ],
            "abstract": "Document académique ENSAE portant sur les méthodes quantitatives, l'analyse statistique et la modélisation économique.",
        }
    if "sémantique" in s or "catalogue" in s:
        return {"results": []}
    if "qcm" in s:
        return {
            "title": "QCM ENSAE (Mode démo — configure GEMINI_API_KEY)",
            "questions": [
                {
                    "question": "Sous les hypothèses de Gauss-Markov, l'estimateur des Moindres Carrés Ordinaires (MCO) est :",
                    "options": [
                        "BLUE (Best Linear Unbiased Estimator)",
                        "Biaisé mais convergent",
                        "Toujours identique à l'estimateur Ridge",
                        "Inapplicable si n > 30",
                    ],
                    "answer_index": 0,
                    "explanation": "Le théorème de Gauss-Markov garantit que sous exogénéité stricte et homoscédasticité, l'estimateur MCO est le meilleur estimateur linéaire sans biais.",
                },
                {
                    "question": "Dans un test de Student bilatéral au seuil α = 5 %, on rejette H0 si :",
                    "options": [
                        "La p-valeur est supérieure à 0,05",
                        "La p-valeur est inférieure à 0,05",
                        "La statistique |t| est inférieure à 1,96",
                        "La variance empirique est nulle",
                    ],
                    "answer_index": 1,
                    "explanation": "Lorsque p-valeur < α, l'observation est jugée incompatible avec l'hypothèse nulle H0 au seuil choisi.",
                },
                {
                    "question": "Quel test permet d'évaluer l'indépendance entre deux variables qualitatives dans un tableau de contingence ?",
                    "options": [
                        "Test de Shapiro-Wilk",
                        "Test du Chi-2 (χ²)",
                        "Test de Dickey-Fuller",
                        "Test de Durbin-Watson",
                    ],
                    "answer_index": 1,
                    "explanation": "Le test du Chi-2 d'indépendance compare les effectifs observés aux effectifs théoriques sous l'hypothèse d'indépendance.",
                },
            ],
        }
    if "flashcards" in s or "cartes" in s:
        return {
            "title": "Flashcards ENSAE (Mode démo — configure GEMINI_API_KEY)",
            "cards": [
                {
                    "front": "Théorème Central Limite (TCL)",
                    "back": "La moyenne empirique centrée-réduite d'un échantillon i.i.d. de variance finie converge en loi vers N(0, 1).",
                },
                {
                    "front": "Condition de stationnarité AR(1) : X_t = φ X_{t-1} + ε_t",
                    "back": "|φ| < 1 (la racine du polynôme caractéristique est hors du disque unité).",
                },
                {
                    "front": "Estimateur MCO en notation matricielle",
                    "back": "β̂ = (X'X)^{-1} X'y lorsque X est de plein rang colonne.",
                },
                {
                    "front": "Test de Durbin-Watson",
                    "back": "Détecte l'autocorrélation d'ordre 1 des résidus d'une régression (valeur proche de 2 = pas d'autocorrélation).",
                },
            ],
        }
    if "debugger" in s or "déboguer" in s:
        return {
            "diagnosis": "Mode démo hors-ligne (ajoute GEMINI_API_KEY dans backend/.env pour l'analyse Gemini complète).",
            "explanation": "Vérifie les types de colonnes, les valeurs manquantes (na.rm = TRUE en R ou dropna() en Python) et les dimensions matricielles avant l'estimation.",
            "fixed_code": prompt.split("Code :\n")[-1][:2000],
            "tips": [
                "Utilise na.rm = TRUE dans mean() / sd() en R.",
                "Vérifie str(df) en R ou df.info() en pandas avant de lancer une régression.",
            ],
        }
    if "correcteur" in s:
        return {
            "corrected": prompt.replace("Texte :\n", "").strip(),
            "changes": [],
            "comment": "Mode démo hors-ligne : ajoute GEMINI_API_KEY dans backend/.env pour activer la correction Gemini.",
        }
    if "apa" in s:
        return {
            "reference": "Auteur, A. (2025). *Titre de la référence*. Éditeur. (Mode démo — ajoute GEMINI_API_KEY)",
            "in_text": "(Auteur, 2025)",
            "in_text_narrative": "Auteur (2025)",
            "missing": ["Clé GEMINI_API_KEY à renseigner dans backend/.env"],
        }
    if "rétroplanning" in s or "coach" in s:
        return {
            "overview": "Rétroplanning généré en mode démo (ajoute GEMINI_API_KEY pour un planning personnalisé Gemini).",
            "days": [
                {
                    "date": datetime.now(timezone.utc).date().isoformat(),
                    "focus": "Révisions ENSAE — Fondamentaux",
                    "is_exam": False,
                    "is_rest": False,
                    "sessions": [
                        {
                            "subject": "Économétrie / Statistiques",
                            "task": "Revoir les démonstrations MCO et tests d'hypothèses + TD sous R/Python",
                            "duration_min": 90,
                        }
                    ],
                }
            ],
            "tips": [
                "Alterne théorie (démonstrations) et pratique (annales + scripts R/Python).",
                "Fais des fiches synthétiques pour les formules clés de Probabilités et Statistiques.",
            ],
        }
    return {}


async def ask_json(prompt: str, system: str):
    sys = (
        system
        + " Réponds UNIQUEMENT avec du JSON valide, sans texte ni balises markdown autour."
    )
    gc = _gemini_client()
    if gc is None:
        return _demo_json_fallback(prompt, sys)
    try:
        resp = await asyncio.to_thread(
            gc.models.generate_content,
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=sys,
                response_mime_type="application/json",
            ),
        )
        return parse_json(resp.text or "{}")
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("LLM JSON parse failed: %s", exc)
        raise HTTPException(502, "L'IA a renvoyé une réponse illisible, réessaie.")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("LLM call failed: %s", exc)
        raise HTTPException(502, "Le service IA Gemini est indisponible pour le moment.")


async def stream_llm(prompt: str, system: str):
    gc = _gemini_client()
    if gc is None:
        demo = (
            "# Fiche de révision ENSAE (Mode démo)\n\n"
            "> Configure ta clé gratuite `GEMINI_API_KEY` dans `backend/.env` pour générer des fiches complètes avec Google Gemini.\n\n"
            "## Idées clés\n"
            "- Synthèse structurée pour les cours de Statistique, Probabilités, Économétrie et Économie.\n"
            "- Vérifie les hypothèses des modèles (linéarité, exogénéité, homoscédasticité, stationnarité).\n\n"
            "## Points de vigilance pour le partiel\n"
            "- Bien justifier chaque test statistique (H0, H1, statistique de test, loi sous H0, règle de décision).\n"
        )
        for part in demo.split(" "):
            yield part + " "
            await asyncio.sleep(0.01)
        return

    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def _run_stream():
        try:
            for chunk in gc.models.generate_content_stream(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(system_instruction=system),
            ):
                if getattr(chunk, "text", None):
                    loop.call_soon_threadsafe(queue.put_nowait, ("delta", chunk.text))
            loop.call_soon_threadsafe(queue.put_nowait, ("done", None))
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, ("err", exc))

    task = asyncio.create_task(asyncio.to_thread(_run_stream))
    try:
        while True:
            kind, payload = await queue.get()
            if kind == "delta":
                yield payload
            elif kind == "err":
                raise payload
            else:
                break
    finally:
        await task
