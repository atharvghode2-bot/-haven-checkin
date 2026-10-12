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
│   │   └── routers/
│   │       ├── alerts.py    # Counselor triage alerts & protected notes
│   │       ├── auth.py      # Authentication, login, registration, and consent
│   │       ├── sessions.py  # Screening lifecycle (start, answer, back, finish)
│   │       └── students.py  # Longitudinal mood and stress trend endpoints
│   ├── tests/
│   │   ├── test_scoring.py  # Deterministic formula and scoring tests
│   │   └── test_api.py      # Full integration tests for auth, roles, and triage
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
│   │   │   ├── StudentHome.tsx  # Dashboard, past sessions history, & trend charts
│   │   │   ├── Screening.tsx    # Conversational chatbot with audio & on-device HUD
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

## Running Automated Tests

Run the backend test suite from the `backend/` directory:

```powershell
cd backend
.\.venv\Scripts\python.exe tests/test_scoring.py
.\.venv\Scripts\python.exe tests/test_api.py
```

To test the frontend production build:

```powershell
cd frontend
npm.cmd run build
```

---

## API Endpoint Reference

| Method | Endpoint | Authorization | Description |
| --- | --- | --- | --- |
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

- **PowerShell blocks npm:** Use `npm.cmd run dev` or `cmd /c "npm run dev"`.
- **Port 8000 already in use:** Run `Get-NetTCPConnection -LocalPort 8000` to find the process ID, then terminate it with `Stop-Process -Id <PID> -Force`.
- **Frontend cannot connect to backend:** Ensure `VITE_API_URL=http://localhost:8000` is set in `frontend/.env` and Uvicorn is running.
- **Microphone input unavailable:** Web Speech API is supported in modern Chromium browsers (Chrome, Edge). If unavailable, text input is seamlessly used.
- **Camera cues unavailable:** Check-ins function 100% without a camera. When allowed, MediaPipe assets load from CDN and execute completely in your browser.
