# Haven Check-in: AI Mental Health Screening Chatbot

> **B.Tech Computer Science and Engineering (Data Science) Project**  
> **Clinical Notice:** Haven Check-in is an academic mental wellness screening aid, **not a diagnostic tool**. It does not establish a medical diagnosis and cannot replace a licensed clinician or emergency service.

Haven Check-in is a multimodal conversational check-in assistant designed for college students. It pairs validated self-report instruments (PHQ-9 and GAD-7) with optional conversational text sentiment and privacy-first on-device facial expression analysis. High-distress check-ins trigger confidential counselor alerts linked only to anonymous student identifiers.

---

## Architecture & Multimodal Signal Fusion

As defined in the system architecture specification, Haven integrates three normalized signals to compute an overall risk score on a 0–100 scale:

$$\text{final\_risk} = 0.5 \times \text{questionnaire\_score} + 0.3 \times \text{text\_sentiment\_score} + 0.2 \times \text{face\_emotion\_score}$$

- **Signal 1: Questionnaire (50% Primary Weight)**
  - PHQ-9 (9 items, max 27, Depression inventory)
  - GAD-7 (7 items, max 21, Anxiety inventory)
  - Calculated with strict deterministic formulas, **never estimated by an LLM**.
- **Signal 2: Free-Text Sentiment (30% Contextual Weight)**
  - Scored using Hugging Face transformer models (when configured) or an embedded clinical lexicon fallback. Fails gracefully if external APIs are unavailable.
- **Signal 3: On-Device Facial Expression (20% Advisory Weight)**
  - MediaPipe Face Landmarker running 100% locally in the student's browser via WebAssembly.
  - Video and images **never leave the device**; only aggregated emotion scores are submitted.
  - **Safety Guard:** Facial expression scores alone can **never independently trigger a high-risk counselor alert**.

---

## Crisis-Support & Safety Workflow

Independent of any LLM, Haven runs a rule-based safety screening on every message:
- Immediate detection of self-harm, suicidal intent keywords, and PHQ-9 Item 9 scores $>0$.
- Instantly displays verified crisis helplines:
  - **Tele-MANAS (Govt. of India):** `14416` or `1800-891-4416` (24/7 Toll-Free Multi-lingual Support)
  - **KIRAN Helpline:** `1800-599-0019` (Ministry of Social Justice & Empowerment)
  - **National Emergency Number:** `112` (Immediate Life-Safety)
  - **Vandrevala Foundation:** `+91 9999 666 555` (24/7 Counseling Call/WhatsApp)
- Automatically dispatches a confidential counselor alert to the campus triage queue.

---

## Repository Structure

```text
├── .cursor/skills/          # UI/UX Pro design intelligence and reasoning profiles
├── backend/
│   ├── .venv/               # Python virtual environment
│   ├── app/
│   │   ├── main.py          # FastAPI application & CORS configuration
│   │   ├── config.py        # Settings loaded from environment variables
│   │   ├── deps.py          # JWT authentication and role-based guards
│   │   ├── nlp.py           # Text sentiment & face emotion score mapping
│   │   ├── questionnaire.py # PHQ-9 and GAD-7 item banks
│   │   ├── schemas.py       # Pydantic request and response models
│   │   ├── scoring.py       # Deterministic scoring, fusion formula & crisis helplines
│   │   ├── security.py      # PBKDF2 password hashing & JWT token generation
│   │   ├── store.py         # Persistence layer (MongoDB & in-memory store)
│   │   ├── chatbot/         # Local LLM runtime, safety checks & conversational memory
│   │   │   ├── llm.py       # BaseLLMProvider & OllamaProvider abstraction
│   │   │   ├── memory.py    # In-memory bounded session context & isolation
│   │   │   ├── prompts.py   # Haven peer wellness persona & prompt templates
│   │   │   ├── safety.py    # Deterministic crisis interception & helplines
│   │   │   └── service.py   # Chatbot orchestration service
│   │   └── routers/
│   │       ├── alerts.py    # Counselor triage alerts & protected notes
│   │       ├── auth.py      # Authentication, login, registration, and consent
│   │       ├── chat.py      # Local Ollama AI wellness chatbot endpoints
│   │       ├── sessions.py  # Screening lifecycle (start, answer, back, finish)
│   │       └── students.py  # Longitudinal mood and stress trend endpoints
│   ├── tests/
│   │   ├── test_scoring.py  # Deterministic formula and scoring tests
│   │   ├── test_api.py      # Full integration tests for auth, roles, and triage
│   │   └── test_chat.py     # Local LLM, memory, and deterministic safety tests
│   ├── .env.example
│   └── requirements.txt
├── design-system/
│   └── haven-check-in/
│       └── MASTER.md        # UI/UX Pro design tokens (Slate/Teal, Lora & Raleway)
├── frontend/
│   ├── src/
│   │   ├── api/client.ts    # Fetch client with TypeScript models
│   │   ├── auth/            # AuthContext provider with token management
│   │   ├── components/      # Accessible UI components (Dialog, Status, Button, Layout)
│   │   ├── lib/             # MediaPipe on-device face sampler & Web Speech voice helper
│   │   ├── pages/
│   │   │   ├── Landing.tsx      # Project overview, methodology, & crisis banner
│   │   │   ├── Auth.tsx         # Sign in, registration, & demo account autofill
│   │   │   ├── Chat.tsx         # Private AI Wellness Chatbot with local inference
│   │   │   ├── StudentHome.tsx  # Dashboard, past sessions history, & trend charts
│   │   │   ├── Screening.tsx    # Conversational check-in with audio & on-device HUD
│   │   │   ├── Results.tsx      # Multimodal score breakdown & self-help resources
│   │   │   ├── Counselor.tsx    # Triage workspace, alert filtering, & student trends
│   │   │   ├── AlertDetail.tsx  # Case management, status updates, & counselor notes
│   │   │   └── Privacy.tsx      # Data protection and camera safety limitations
│   │   └── styles/
│   │       ├── tokens.css   # Colors, typography, spacing tokens from MASTER.md
│   │       └── app.css      # Swiss-minimal layout, chat bubbles, & animations
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── Chatbot_Architecture.docx# Reference system architecture document
├── docker-compose.yml       # Optional local MongoDB container service
└── README.md
```

---

## Demo Accounts

Pre-seeded local test credentials for project evaluation:

| Role | Email | Password | Identifier / Permissions |
| --- | --- | --- | --- |
| **Student** | `student@haven.edu` | `Student123!` | Anonymous Code: `STU-4C91` |
| **Counselor** | `counselor@haven.edu` | `Counselor123!` | Campus counselor triage access |

*Quick autofill buttons are available on the Sign In page for one-click authentication.*

---

## Prerequisites

- **Python 3.12+**
- **Node.js 20+**
- **MongoDB 7** (Optional: the backend automatically runs in memory when `USE_MEMORY_DB=true`)

---

## Local Installation & Execution (Windows Instructions)

Open two separate terminal windows in your project directory:

### Terminal 1 — Backend API (FastAPI)

```powershell
cd backend

# If virtual environment is not yet created:
# python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt

# Create .env from template if not present
if (!(Test-Path .env)) { Copy-Item .env.example .env }

# Start the FastAPI development server
uvicorn app.main:app --reload --port 8000
```

- API Base URL: `http://127.0.0.1:8000`
- Interactive OpenAPI Swagger Documentation: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

### Terminal 2 — Frontend Application (Vite + React)

*Note: On Windows PowerShell, use `npm.cmd` to bypass default PowerShell execution policy restrictions.*

```powershell
cd frontend

# Install dependencies
npm.cmd install

# Create .env from template if not present
if (!(Test-Path .env)) { Copy-Item .env.example .env }

# Start the Vite development server
npm.cmd run dev
```

- Application URL: `http://localhost:5173`

---

## Database Configuration (MongoDB & In-Memory Mode)

### Default: In-Memory Database Mode
For zero-setup local demonstration, `USE_MEMORY_DB=true` is enabled by default in `backend/.env`. All seed data, screening sessions, counselor alerts, and notes are stored in memory and reset on process restart.

### Optional: Local MongoDB Persistence
To enable full persistence with MongoDB:
1. Start MongoDB with Docker:
   ```bash
   docker compose up -d
   ```
2. In `backend/.env`, set:
   ```env
   USE_MEMORY_DB=false
   MONGO_URI=mongodb://localhost:27017
   MONGO_DB=haven_checkin
   ```
If MongoDB is temporarily unavailable, the application gracefully logs a warning and falls back to in-memory mode without crashing.

### Data Collections
The database supports all 5 entities specified in the architecture document:
1. `users`: Student accounts with anonymous codes, counselor accounts, consent flags.
2. `sessions`: Check-in session state, answer index, completed status, fusion results.
3. `responses`: Per-question answer values, text reflections, and timestamps.
4. `alerts`: Triage cases for elevated distress, status progression, crisis flags, counselor notes.
5. `counselors`: Counselor profiles and assigned anonymous student lists.

---

## Local Open-Source AI Wellness Companion (Ollama Runtime)

Haven integrates an **on-device, local-first AI mental wellness chatbot** powered by open-source models through **Ollama** and orchestrated via FastAPI.

### Priorities & Guarantees
- **No Per-Message Cost:** Zero external cloud LLM API fees (100% free and open-source).
- **Private & Local Inference:** Prompts and responses never leave your machine when running locally.
- **Model Abstraction:** Swappable runtime abstraction (`BaseLLMProvider` / `OllamaProvider`) allowing seamless changes to model identifiers or alternative runtimes without touching application logic.
- **Independent Safety Layer:** Deterministic crisis safety checks run before the LLM and intercept acute self-harm/crisis content with verified 24/7 helplines.
- **Screening System Separation:** The chatbot is a companion for daily reflection; validated PHQ-9/GAD-7 scoring formulas, text sentiment, and camera emotion scores are strictly preserved and kept separate.

### Model Selection & Hardware Profile
- **Default Configured Model:** `qwen2.5:3b` (Qwen 2.5 3B Instruct, Q4_K_M quantized GGUF)
  - **Download Size / Disk:** ~1.93 GB
  - **Memory Footprint:** ~2.8 GB VRAM / System RAM (runs comfortably on 4GB–8GB GPUs or 8GB+ CPU systems)
  - **Verified Hardware:** Tested on NVIDIA GeForce RTX 4060 Laptop GPU (8GB VRAM) and 16GB System RAM with sub-second token latency.
  - **License:** Open weights under Apache 2.0 / Qwen Research License (permissive for research and applications).
- **Alternative Compatible Models:**
  - `qwen2.5:1.5b` (~986 MB): Ultra-lightweight for low-RAM laptops or CPU-only setups.
  - `llama3.2:3b` (~2.0 GB): Meta Llama 3.2 community license.
  - `mistral:7b` (~4.1 GB): High-capacity reasoning for systems with 12GB+ RAM.

### Facial Emotion Detection Integration (Privacy-First On-Device Cues)

Haven seamlessly connects the existing on-device facial emotion detection feature (`frontend/src/lib/face.ts`) to the AI Wellness Chatbot as an optional, supplementary context:

1. **On-Device Analysis (MediaPipe FaceLandmarker):**
   - MediaPipe runs in WebAssembly locally in the student's browser.
   - Maps 52 Facial Action Coding System (FACS) blendshapes into 7 canonical emotion probabilities (`neutral`, `happy`, `sad`, `angry`, `fearful`, `surprised`, `disgusted`).
   - Observations are aggregated and smoothed over rolling windows (requiring $\ge 3$ frames) to prevent single-frame noise.

2. **Zero Raw Media Transmission:**
   - **Never** transmits video frames, base64 images, or camera feeds to the FastAPI backend or to Ollama.
   - Transmits only an optional, minimal numeric summary (`dominant_emotion`, genuine confidence score, sample count, and client timestamp).

3. **Weak Supplementary Signal & Safety Guardrails:**
   - **Student's typed words always take absolute priority.** If written words contradict facial estimates (e.g. user writes "I feel happy and relieved" while camera predicts tension), the assistant addresses only the written text.
   - **Never asserts feelings or diagnoses:** The model is strictly instructed never to tell users they look sad/angry/anxious, never to diagnose mental health conditions, and never to calculate clinical severity or suicidal intent from camera cues.
   - **No score recitation:** Technical emotion scores or percentages are never quoted in ordinary conversation.
   - **Staleness cutoff:** Backend and frontend treat predictions older than 12–15 seconds as unavailable and discard them automatically.
   - **Ephemerality & Privacy:** Emotion context is never persisted to database or stored in conversation history. Once a turn completes or camera is disabled, subsequent turns receive zero emotion context.

4. **Minimal Camera Status UI:**
   - Reuses the existing minimal dot indicator without a large video preview:
     - **Gray dot:** Camera disabled.
     - **Amber dot:** Initializing camera stream and loading WebAssembly model.
     - **Green dot:** Camera active and emotion detection pipeline ready.
   - Explicit user toggle and consent modal: camera starts disabled by default and is never silently activated.
   - Chatbot remains 100% usable when camera is off or permission is denied.

### Ollama Setup & Model Download

1. **Install Ollama:**
   - **Windows:** Download the installer from [ollama.com/download/windows](https://ollama.com/download/windows) and run the installer.
   - **macOS:** Download from [ollama.com/download/mac](https://ollama.com/download/mac) or run `brew install ollama`.
   - **Linux:** Run `curl -fsSL https://ollama.com/install.sh | sh`.

2. **Start the Ollama Service:**
   ```powershell
   ollama serve
   ```
   *(By default, Ollama listens locally on `http://127.0.0.1:11434`)*

3. **Pull the Configured Model:**
   ```powershell
   ollama pull qwen2.5:3b
   ```

---

## Multimodal Emotional Insights: Facial Analysis, NLP Scoring & Fusion Report

Haven integrates a comprehensive emotional insights reporting pipeline that analyzes conversational language tone alongside browser-based facial tracking, generating a private, non-clinical reflection summary for university students.

### 1. Facial Expression Analysis (MediaPipe FaceLandmarker)
- **Model / Technology:** MediaPipe FaceLandmarker running on-device in WebAssembly (`float16/1/face_landmarker.task`).
- **Supported Labels:** 7 canonical Facial Action Coding System (FACS) blendshape categories:
  `neutral`, `happy`, `sad`, `angry`, `fearful`, `surprised`, `disgusted`.
- **Temporal & Window Aggregation:**
  - Evaluates frames at ~1.2s intervals without overwhelming CPU/GPU threads.
  - Requires $\ge 3$ valid frames to eliminate single-frame visual noise.
  - Windowed aggregation averages probabilities and calculates the proportion of observations where each emotion was dominant.
  - Trajectory analysis compares early vs. late observation windows to detect composure shifts.
- **Privacy & Boundaries:**
  - Zero raw image/video transmission. Video feeds stay 100% on-device in browser memory.
  - Stale frames (>12–15s old) are discarded automatically.
  - Explicit non-clinical limitation: Visual cues reflect screen focus, ambient lighting, and posture, and **never prove internal feelings or establish a clinical diagnosis**.

### 2. NLP-Based Message Emotion Analysis
- **Model Selected:** `cardiffnlp/twitter-roberta-base-sentiment-latest`
  - **Intended Task:** 3-class text sentiment and emotional tone classification.
  - **Actual Supported Labels:** `negative`, `neutral`, `positive` (never forces unsupported clinical categories).
  - **License:** Apache 2.0 (open-source, permissive).
  - **Resource Profile:** ~500 MB model weights. Runs locally with PyTorch or remotely via Hugging Face Inference API when `HF_API_TOKEN` is set.
- **Transparent Lightweight Fallback (`clinical_lexicon_fallback`):**
  - **Task:** Rule-calibrated valence & emotional tone classification for student wellness check-ins.
  - **Documented Limitations:** Rule-based keyword/phrase evaluator. Lacks syntactic tree parsing, deep context modeling, and cannot detect sarcasm or complex figurative phrasing. **Not a trained deep-learning NLP model.**
  - **Supported Labels:** `negative`, `neutral`, `positive`.
  - **Calibrated Confidence:** Continuous valence intensity with confidence calibrated from keyword density and word count.
- **Analysis Scope:**
  - Analyzes **strictly user messages**, never AI assistant responses.
  - Extracts cautious qualitative language themes (e.g. academic deadline load, sleep disruption, cognitive overwhelm, grounding practices).

### 3. Cross-Source Emotion Fusion & Non-Diagnostic Report
- **Concordance Analysis:**
  - Maps compatible valence dimensions:
    - Positive Tone: NLP `positive` $\leftrightarrow$ Face `happy`
    - Composed Tone: NLP `neutral` $\leftrightarrow$ Face `neutral`
    - Distress/Tension: NLP `negative` $\leftrightarrow$ Face `sad`, `fearful`, `angry`, `disgusted`
    - Arousal: Face `surprised` (treated as context-dependent alertness)
- **Divergence Handling:**
  - If sources disagree (e.g. positive text with furrowed brow), the system **never forces a false consensus**.
  - Reassuringly explains that visual tension frequently reflects reading concentration, screen glare, or physical posture.
  - **Student's typed words always take absolute priority.**
- **Single-Source Reporting:**
  - If camera is disabled or stale, produces a single-source report reflecting language reflections only.
- **Clinical Safeguards:**
  - **Zero Composite Mental Health Severity Score:** Does not combine unvalidated emotion signals into a clinical severity number.
  - Includes non-judgmental reflective questions and verified crisis helplines (Tele-MANAS `14416`, KIRAN `1800-599-0019`, Emergency `112`).

### 4. Privacy & Session Lifecycle Controls
- Derived emotion analyses are kept in **in-memory session storage only** and isolated by `conversation_id` and `owner_id`.
- The user can click **Clear Derived Analysis** at any time to purge emotion histories without losing their conversation text.
- Disabling the camera stops hardware camera tracks immediately.

---

## Running Automated Tests

Run the backend test suite from the `backend/` directory:

```powershell
cd backend
.\.venv\Scripts\python.exe tests/test_scoring.py
.\.venv\Scripts\python.exe tests/test_api.py
.\.venv\Scripts\python.exe tests/test_chat.py
.\.venv\Scripts\python.exe tests/test_emotional_report.py
```


To test the frontend production build:

```powershell
cd frontend
npm.cmd run build
```

---

## Cloud Deployment (Render)

Haven Check-in includes a [`render.yaml`](render.yaml) Blueprint specification for deploying both services on Render:

- **Backend (Render Web Service):** FastAPI app with `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Operates within Render's free tier (512 MB RAM) by connecting to hosted open-source Qwen 2.5 (`qwen/qwen-2.5-7b-instruct:free`) via OpenRouter, or running with local Ollama during development.
- **Frontend (Render Static Site):** React/Vite client built via `npm install && npm run build` with SPA rewrite rules (`/* -> /index.html`).
- **Environment Variables:** Set `VITE_API_BASE_URL` on the frontend pointing to your backend URL, and `CORS_ORIGINS` on the backend including your frontend URL.

---

## API Endpoint Reference

| Method | Endpoint | Authorization | Description |
| --- | --- | --- | --- |
| `POST` | `/api/chat` (alias `/chat`) | Optional Bearer | Send message to Haven Wellness Chatbot; receives empathetic reply or crisis interception |
| `GET` | `/api/chat/status` (alias `/chat/status`) | Public | Check Ollama connectivity, model status, and installed models |
| `POST` | `/api/chat/reset` (alias `/chat/reset`) | Optional Bearer | Clear in-memory bounded conversation history for session |
| `POST` | `/auth/register` | Public | Register new student or counselor account |
| `POST` | `/auth/login` | Public | Authenticate user and receive JWT access token |
| `GET` | `/auth/me` | Signed-in | Retrieve authenticated user profile |
| `POST` | `/auth/consent` | Signed-in | Update camera, voice, and data processing consents |
| `GET` | `/questionnaire` | Signed-in | Retrieve PHQ-9 & GAD-7 item bank |
| `POST` | `/sessions` | Student | Start a new screening session |
| `POST` | `/sessions/{id}/answer` | Student | Submit response to current item and get next question |
| `POST` | `/sessions/{id}/back` | Student | Step back to previous question |
| `GET` | `/sessions/{id}` | Student | Fetch session status and results (own session only) |
| `POST` | `/sessions/{id}/finish` | Student | Finalize screening, compute fusion score, trigger safety alerts |
| `GET` | `/students/me/sessions` | Student | List all screening sessions for authenticated student |
| `GET` | `/students/me/history` | Student | Retrieve mood and stress trend points |
| `GET` | `/students/{id}/trends` | Owner / Counselor | View longitudinal mood trend points (forbidden across students) |
| `GET` | `/alerts` | Counselor | List triage alerts with status, search, and band filters |
| `GET` | `/alerts/{id}` | Counselor | Retrieve alert details, session metrics, and case notes |
| `PATCH` | `/alerts/{id}` | Counselor | Update alert status (`open`, `acknowledged`, `in_review`, `resolved`) |
| `POST` | `/alerts/{id}/notes` | Counselor | Add protected clinical or outreach case notes |
| `GET` | `/health` | Public | Service health verification |

---

## Troubleshooting

- **Ollama runtime unreachable (503):** Ensure Ollama is running (`ollama serve`) and listening on port `11434`. Check status via `http://localhost:11434/api/tags`.
- **Model missing in Ollama:** Run `ollama pull qwen2.5:3b`. You can also configure a different downloaded model via `OLLAMA_MODEL=<name>` in `backend/.env`.
- **PowerShell blocks npm:** Use `npm.cmd run dev` or `cmd /c "npm run dev"`.
- **Port 8000 already in use:** Run `Get-NetTCPConnection -LocalPort 8000` to find the process ID, then terminate it with `Stop-Process -Id <PID> -Force`.
- **Frontend cannot connect to backend:** Ensure `VITE_API_URL=http://localhost:8000` is set in `frontend/.env` and Uvicorn is running.
- **Camera cues unavailable:** Check-ins function 100% without a camera. When allowed, MediaPipe assets load from CDN and execute completely in your browser.
