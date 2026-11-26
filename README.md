# 📚 StudyHub ENSAE

> Réseau social académique pour les étudiants de l'ENSAE — partage de cours, entraide, tutorat et outils IA.

[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://studyensae.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render)](https://studyhub-ensae.onrender.com)
[![Database](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248?logo=mongodb)](https://www.mongodb.com/atlas)
[![License](https://img.shields.io/badge/Licence-MIT-blue)](LICENSE)

---

## 🌐 Liens de production

| Service | URL |
|---|---|
| **Application** | https://studyensae.vercel.app |
| **API Backend** | https://studyhub-ensae.onrender.com/api/ |
| **GitHub** | https://github.com/SMS-LH/studyhub-ensae |

---

## 👥 Équipe

| Nom | Rôle |
|---|---|
| **Ndeye Codou Mbodj** | Développeuse |
| **Arame Kane** | Développeuse |
| **Mourtalla Sall** | Développeur |
| **Ibrahima Diallo** | Développeur |

---

## 🏫 Classes supportées

L'application est dédiée aux **10 filières de l'ENSAE** :

| Filière | Filière |
|---|---|
| `ISEP1` | `ISEP2` |
| `ISE1-Cycle Long` | `ISE1 Math` |
| `ISE1 Eco` | `ISE2` |
| `ISE3` | `AS1` |
| `AS2` | `AS3` |

---

## ✨ Fonctionnalités

### 1. 📰 Fil de classe (`ClassFeedPage`)
- Publication de posts texte, images, liens
- **Sondages** (polls) avec résultats en temps réel
- **Mentions** `@utilisateur` avec notifications ciblées
- **Épinglage** de posts importants (délégué / modérateur)
- **Signets** (bookmarks) personnels
- **Événements** affichés dans « Ma semaine » (mini-calendrier)
- **Filtres** : Tout, Annonces, Ressources, Événements, Sondages
- **Recherche** dans les posts de la classe
- Réactions (likes) et commentaires avec fil de réponses
- **Annonces** publiables par les délégués et modérateurs uniquement

### 2. 📂 Bibliothèque (`LibraryPage`)
- Upload de fichiers : PDF, Word, PowerPoint, code, vidéo
- **Versioning** des documents (historique des modifications)
- **Partage inter-promo** : un délégué ISE2 peut pousser un doc vers ISE1
- **Recherche sémantique** dans les documents
- **Stockage persistant** via Cloudinary (fallback `/tmp` local)
- Prévisualisation en ligne (`DocViewer`) avec lecteur PDF/vidéo
- Commentaires sur les documents
- Accès scopé par classe : chaque étudiant voit uniquement sa bibliothèque

### 3. 🤝 Tutorat (`TutoringPage`)
- **Annuaire des tuteurs** : filtrable par matière, classe, disponibilité
- **Demande de tutorat** : envoi de demande avec matière et message
- **Messagerie intégrée** entre tuteur et apprenant
- **Système de remerciements** après une session
- Visible par toutes les classes (entraide inter-promo)

### 4. 🤖 Assistant IA (`AssistantPage`)
Propulsé par **Google Gemini** (`v1beta` avec chaîne de modèles de secours) :

| Outil | Description |
|---|---|
| **Résumé** | Résumé streamé d'un document ou texte collé |
| **QCM** | Génère des quiz à choix multiples depuis un document |
| **Flashcards** | Création de cartes mémoire (recto/verso) |
| **Débogueur** | Analyse et corrige du code avec explications |
| **Correcteur** | Correction grammaticale et stylistique |
| **Citation APA** | Génère des références bibliographiques APA |
| **Planificateur** | Crée un plan de révision personnalisé |

> Modèles Gemini (par ordre de priorité) : `gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-2.0-flash` → autodécouverte via `models.list()`

### 5. 💬 Messagerie (`MessagesPage`)
- Messages directs entre étudiants en **temps réel** (WebSocket)
- Historique des conversations
- Indicateur de présence

### 6. 🗂️ Espaces de travail (`WorkspacesPage` / `WorkspacePage`)
- Création d'espaces collaboratifs par groupe / binôme
- **Tableau Kanban** (tâches : À faire, En cours, Fait)
- **Éditeur de notes** partagé en temps réel
- **Ressources** : liens et fichiers attachés à l'espace
- **Binômes** : gestion des membres de l'espace
- Chat interne à l'espace de travail

### 7. 🌍 Forum (`ForumPage`)
- Discussions ouvertes **toutes classes confondues**
- Catégories thématiques
- Réponses imbriquées

### 8. 🛡️ Modération (`ModerationPage`)
- **Délégués de classe** (`class_admin`) : gèrent les posts et annonces de leur classe
- **Modérateurs BDE** : gèrent toutes les classes, peuvent supprimer des utilisateurs
- Signalement de contenus inappropriés
- Tableau de bord statistiques (posts, utilisateurs, signalements)
- Suppression de compte utilisateur (`DELETE /api/moderation/users/{id}`)

### 9. 🔔 Notifications (`NotificationBell`)
- Ciblées : mentions `@`, commentaires, annonces, demandes de tutorat
- Marquage lu / tout marquer comme lu

### 10. 👤 Profil (`ProfilePage`)
- Photo de profil, biographie, compétences
- Statistiques personnelles (posts, documents, sessions de tutorat)
- Historique d'activité

### 11. 🔐 Authentification (`AuthPage`)
- Inscription avec vérification de classe ENSAE
- Connexion sécurisée (JWT / `PyJWT`)
- **Réinitialisation de mot de passe par email** :
  - Envoi via **Brevo API** (priorité) → **Resend API** → SMTP stdlib (fallback)

---

## 🏗️ Architecture

```
studyhub-ensae/
├── backend/                  # API FastAPI (Python 3.12)
│   ├── server.py             # Point d'entrée, CORS, routes, WebSocket
│   ├── core.py               # DB (Motor/MongoDB), Cloudinary, JWT, email
│   ├── auth_routes.py        # Inscription, connexion, reset password
│   ├── feed_routes.py        # Posts, sondages, réactions, événements
│   ├── library_routes.py     # Documents, versioning, partage inter-promo
│   ├── tutoring_routes.py    # Annuaire, demandes, messagerie tutorat
│   ├── ai_routes.py          # Résumé, QCM, flashcards, débogueur…
│   ├── chat_routes.py        # Messagerie directe (WebSocket)
│   ├── workspace_routes.py   # Espaces de travail collaboratifs
│   ├── moderation_routes.py  # Signalements, suppression, stats
│   ├── notification_routes.py# Notifications ciblées
│   ├── profile_routes.py     # Profils utilisateurs
│   ├── live_notes.py         # Notes partagées en temps réel
│   ├── gamification.py       # Système de badges (non exposé dans l'UI)
│   ├── seed.py               # Données de démo
│   ├── render.yaml           # Configuration Render
│   ├── requirements.txt      # Dépendances Python
│   └── .env.example          # Variables d'environnement requises
│
└── frontend/                 # React 18 + Tailwind CSS
    ├── src/
    │   ├── App.js            # Routage (React Router)
    │   ├── pages/            # Pages principales (une par fonctionnalité)
    │   │   ├── AuthPage.jsx
    │   │   ├── ClassFeedPage.jsx
    │   │   ├── LibraryPage.jsx
    │   │   ├── TutoringPage.jsx
    │   │   ├── AssistantPage.jsx
    │   │   ├── MessagesPage.jsx
    │   │   ├── WorkspacesPage.jsx / WorkspacePage.jsx
    │   │   ├── ForumPage.jsx
    │   │   ├── ModerationPage.jsx
    │   │   ├── ProfilePage.jsx
    │   │   └── DocumentPage.jsx
    │   ├── components/
    │   │   ├── Layout.jsx            # Navigation principale
    │   │   ├── NotificationBell.jsx  # Cloche de notifications
    │   │   ├── common.jsx            # Composants réutilisables
    │   │   ├── ai/                   # Outils IA (Summary, Quiz, Flashcards…)
    │   │   ├── library/              # DocCard, DocViewer, UploadDialog…
    │   │   ├── profile/              # ProfileEditDialog, StatsGrid…
    │   │   ├── workspace/            # KanbanBoard, NotesEditor, BinomesPanel…
    │   │   └── ui/                   # shadcn/ui (Button, Dialog, Tabs…)
    │   ├── context/
    │   │   └── AuthContext.jsx       # Contexte d'authentification global
    │   ├── lib/
    │   │   ├── api.js                # Client Axios centralisé
    │   │   └── utils.js              # Utilitaires
    │   └── hooks/
    │       └── use-toast.js          # Hook de notifications toast
    ├── tailwind.config.js
    ├── vercel.json               # Configuration Vercel (SPA rewrites)
    └── package.json
```

---

## 🛠️ Stack technique

### Backend
| Technologie | Version | Usage |
|---|---|---|
| **Python** | 3.12 | Langage principal |
| **FastAPI** | ≥ 0.110 | Framework API REST + WebSocket |
| **Uvicorn** | ≥ 0.29 | Serveur ASGI |
| **Motor** | ≥ 3.6 | Driver MongoDB asynchrone |
| **PyMongo** | ≥ 4.6 | Driver MongoDB synchrone |
| **PyJWT** | ≥ 2.8 | Authentification JWT |
| **bcrypt** | ≥ 4.1 | Hachage des mots de passe |
| **google-genai** | ≥ 1.0 | SDK Google Gemini |
| **httpx** | ≥ 0.27 | Requêtes HTTP async (Cloudinary, Brevo) |
| **pypdf** | ≥ 4.0 | Extraction texte PDF |
| **python-docx** | ≥ 1.1 | Extraction texte Word |
| **python-pptx** | ≥ 1.0 | Extraction texte PowerPoint |
| **diff-match-patch** | ≥ 20241021 | Versioning documents |
| **websockets** | ≥ 12.0 | Messagerie temps réel |
| **pytest** + **pytest-asyncio** | ≥ 8.0 | Tests unitaires |

### Frontend
| Technologie | Usage |
|---|---|
| **React 18** | Framework UI |
| **React Router v6** | Routage côté client |
| **Tailwind CSS** | Styling utilitaire |
| **shadcn/ui** + **Radix UI** | Composants accessibles |
| **Axios** | Client HTTP |
| **lucide-react** | Icônes |
| **craco** | Surcharge CRA (Tailwind) |

### Infrastructure
| Service | Usage | Plan |
|---|---|---|
| **Vercel** | Hébergement frontend | Gratuit |
| **Render** | Hébergement backend | Gratuit |
| **MongoDB Atlas** | Base de données cloud | M0 (gratuit) |
| **Cloudinary** | Stockage fichiers persistant | Gratuit |
| **Brevo** | Envoi d'emails (API HTTPS) | Gratuit |
| **Google AI Studio** | Clé API Gemini | Gratuit |

---

## ⚙️ Variables d'environnement

### Backend (`backend/.env`)
```env
# Base de données
MONGO_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/studyhub

# Authentification
JWT_SECRET=<clé-secrète-longue>

# IA Gemini
GEMINI_API_KEY=AIza...

# Stockage fichiers (optionnel — fallback /tmp si absent)
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>

# Email — Brevo (priorité)
BREVO_API_KEY=xkeysib-...
SMTP_FROM=no-reply@votredomaine.com

# Email — Resend (secours si Brevo absent)
RESEND_API_KEY=re_...

# Email — SMTP stdlib (dernier recours)
SMTP_HOST=smtp.brevo.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

### Frontend (`frontend/.env`)
```env
REACT_APP_API_URL=https://studyhub-ensae.onrender.com
```

---

## 🚀 Lancer en local

### Prérequis
- Python 3.12+
- Node.js 18+
- Compte MongoDB Atlas (ou MongoDB local)

### Backend
```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Remplir les variables dans .env

uvicorn server:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Mettre REACT_APP_API_URL=http://localhost:8000

npm start
```

L'application sera disponible sur `http://localhost:3000`.

---

## 🧪 Tests

```bash
cd backend
# Activer le venv
.venv\Scripts\activate  # Windows

# Tests des fonctionnalités principales
python -m pytest tests/ -v

# Ou lancer les scripts de test directement
python test_new_features.py
python test_password_reset.py
```

---

## 🗄️ Base de données — Collections MongoDB

| Collection | Description |
|---|---|
| `users` | Comptes étudiants (nom, email, classe, rôle) |
| `posts` | Posts du fil de classe (texte, sondages, événements) |
| `comments` | Commentaires sur les posts |
| `documents` | Métadonnées des fichiers de bibliothèque |
| `document_versions` | Historique des versions de documents |
| `tutoring_requests` | Demandes de tutorat |
| `tutoring_messages` | Messages échangés dans le cadre du tutorat |
| `messages` | Messages directs entre utilisateurs |
| `workspaces` | Espaces de travail collaboratifs |
| `workspace_tasks` | Tâches Kanban |
| `workspace_notes` | Notes partagées |
| `forum_posts` | Posts du forum inter-classes |
| `notifications` | Notifications ciblées |
| `reports` | Signalements de contenus |
| `bookmarks` | Signets des utilisateurs |

---

## 🔐 Rôles utilisateurs

| Rôle | Permissions |
|---|---|
| `student` | Accès à toutes les fonctionnalités en lecture/écriture dans sa classe |
| `class_admin` | Délégué de classe : peut publier des annonces, épingler des posts, partager des docs vers d'autres classes |
| `moderator` | BDE : toutes les permissions + suppression de comptes utilisateurs |

---

## 📡 Endpoints API principaux

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/` | Santé de l'API (config IA, Cloudinary, email) |
| `POST` | `/api/auth/register` | Inscription |
| `POST` | `/api/auth/login` | Connexion |
| `POST` | `/api/auth/forgot-password` | Envoi email reset |
| `POST` | `/api/auth/reset-password` | Réinitialisation mot de passe |
| `GET` | `/api/feed/{class_name}` | Fil de classe |
| `POST` | `/api/feed/{class_name}/posts` | Créer un post |
| `GET` | `/api/library/` | Documents de la classe |
| `POST` | `/api/library/upload` | Uploader un fichier |
| `GET` | `/api/tutoring/` | Annuaire des tuteurs |
| `POST` | `/api/ai/summary` | Résumé IA (streaming) |
| `POST` | `/api/ai/quiz` | Génération QCM |
| `POST` | `/api/ai/flashcards` | Génération flashcards |
| `GET` | `/api/notifications/` | Notifications |
| `GET` | `/api/moderation/stats` | Statistiques modération |
| `DELETE` | `/api/moderation/users/{id}` | Supprimer un utilisateur (modérateur BDE) |
| `WS` | `/ws/chat/{user_id}` | WebSocket messagerie directe |

---

## 🚢 Déploiement

### Render (Backend)
1. Connecter le dépôt GitHub à Render
2. Service type : **Web Service**
3. Build command : `pip install -r requirements.txt`
4. Start command : `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. Ajouter les variables d'environnement dans **Environment**

> ⚠️ Le plan gratuit Render bloque les ports SMTP (587/465). Utiliser **Brevo API** ou **Resend API** pour les emails.

> ⚠️ Les fichiers en `/tmp` sont perdus au redémarrage. Configurer `CLOUDINARY_URL` pour un stockage persistant.

### Vercel (Frontend)
1. Importer le dossier `frontend/` depuis GitHub
2. Framework : **Create React App**
3. Ajouter `REACT_APP_API_URL` dans les variables d'environnement Vercel

---

## 📌 Notes importantes

- **Bibliothèque scopée par classe** : chaque étudiant voit uniquement les documents de sa propre classe. Le partage inter-promo est un *push* unidirectionnel (délégué ISE2 → ISE1).
- **Cloudinary PDF** : activer *"Allow delivery of PDF and ZIP files"* dans Cloudinary → Settings → Security.
- **Clé Brevo** : utiliser la clé de l'onglet **"Clés API"** (commence par `xkeysib-`), pas celle de l'onglet SMTP.
- **Gemini SDK** : utilise `v1beta` pour supporter les instructions système (`system_instruction`).
- **Render cold start** : le service peut mettre ~30 secondes à répondre après inactivité (plan gratuit). Configurer UptimeRobot pour le maintenir actif.

---

## 📄 Licence

MIT — Projet académique ENSAE, 2024-2025.
