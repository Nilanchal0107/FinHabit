# FinHabits 2.0

> AI-powered, semi-automated personal finance PWA for Indian users — built for the **Google Solution Challenge 2026**.

FinHabits turns bank SMS notifications into structured expense data via a 4-tier AI parsing pipeline. Users share a received SMS, get an AI-categorised transaction in <1 second, confirm with one tap, and over time the app auto-fills repeat merchants with learned patterns.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  FRONTEND  (Purple layer)                                        │
│  React 18 + Vite + Tailwind + Zustand + TanStack Query          │
│  Deployed: Firebase Hosting                                      │
│  PWA: Web Share Target — share SMS → opens FinHabits            │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS (Firebase ID token)
┌────────────────────────────▼─────────────────────────────────────┐
│  BACKEND  (Teal layer)                                           │
│  Node.js 20 + Express + Firebase Admin SDK                       │
│  Deployed: Google Cloud Run (asia-south1)                        │
│                                                                  │
│  4-Tier SMS Parsing Pipeline:                                    │
│  Tier 0 → Pattern Engine (Firestore, ~5ms, confidence: 1.0)     │
│  Tier 1 → Regex Engine  (~50ms, 20+ Indian bank patterns)       │
│  Tier 2 → Groq Llama 3.1 70B (~800ms)                          │
│  Tier 3 → Vertex AI Gemini 1.5 Flash (fallback, always returns) │
└───────────────┬──────────────────────────┬───────────────────────┘
                │                          │
┌───────────────▼──────┐     ┌─────────────▼──────────────────────┐
│  DATABASE  (Amber)   │     │  AI  (Coral)                        │
│  Firebase Firestore  │     │  Groq Cloud — Llama 3.1 70B        │
│  AES-256-GCM at rest │     │  Vertex AI — Gemini 1.5 Flash      │
│  Firebase Auth       │     │  Firebase Remote Config             │
└──────────────────────┘     └─────────────────────────────────────┘
```

---

## Repository Structure

```
Finhabits/
├── frontend/                    # React PWA (Vite)
│   ├── public/
│   │   ├── manifest.json        # PWA manifest (Web Share Target)
│   │   ├── firebase-messaging-sw.js
│   │   └── icons/               # 192.png, 512.png (maskable)
│   ├── src/
│   │   ├── components/          # UI components
│   │   ├── pages/               # Route-level pages
│   │   ├── store/               # Zustand stores
│   │   ├── hooks/               # React Query + custom hooks
│   │   ├── services/            # Firebase, API client
│   │   └── utils/               # Helpers, formatters
│   ├── vite.config.js           # Vite + PWA plugin config
│   └── tailwind.config.js
│
├── backend/                     # Express API (Cloud Run)
│   ├── src/
│   │   ├── server.js            # Express app entry point
│   │   ├── firebase-admin.js    # Admin SDK init
│   │   ├── routes/              # /parse-sms, /confirm-transaction, etc.
│   │   ├── services/            # SMS parser, encryption, Groq, Vertex AI
│   │   ├── middleware/          # Auth, rate limiting, validation
│   │   └── utils/               # Prompts, helpers
│   └── Dockerfile               # Multi-stage, non-root, node:20-alpine
│
├── firebase.json                # Firebase Hosting + Firestore deploy config
├── firestore.rules              # Firestore security rules
├── cloudbuild.yaml              # Cloud Build CI/CD pipeline
├── scheduler-setup.sh           # One-time Cloud Scheduler job registration
└── README.md
```

---

## Local Development Setup

### Prerequisites

- Node.js 20 LTS — [nodejs.org](https://nodejs.org)
- Firebase project with **Authentication** (Google + Phone OTP) and **Firestore** enabled
- [Groq API key](https://console.groq.com) (free tier available)
- Google Cloud project with **Vertex AI API** enabled (for Tier 3 fallback)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_ORG/finhabits.git
cd finhabits

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Configure environment variables

#### Backend — `backend/.env`

```env
# ── Server ──────────────────────────────────────────────────────
PORT=8080
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# ── Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") ──
ENCRYPTION_KEY=your_64_hex_character_key_here

# ── Firebase Admin SDK ───────────────────────────────────────────
# Paste the full JSON from Firebase Console → Project Settings → Service Accounts
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
GCP_PROJECT_ID=your-gcp-project-id

# ── AI Providers ─────────────────────────────────────────────────
GROQ_API_KEY=gsk_...

# ── Cloud Scheduler Auth ─────────────────────────────────────────
# Must match the x-scheduler-secret header sent by Cloud Scheduler
CLOUD_SCHEDULER_SECRET=your_random_32_char_secret
```

#### Frontend — `frontend/.env.local`

```env
# ── Firebase Web SDK (from Firebase Console → Project Settings → General) ──
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# ── Backend API ──────────────────────────────────────────────────
VITE_API_URL=http://localhost:8080/api

# ── FCM (from Firebase Console → Project Settings → Cloud Messaging) ──
VITE_FIREBASE_VAPID_KEY=BNxyz...
```

### 3. Run locally

```bash
# Terminal 1 — Backend (http://localhost:8080)
cd backend
npm run dev

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend
npm run dev
```

---

## Environment Variables Reference

| Variable | Location | Description |
|---|---|---|
| `PORT` | Backend | Server port (injected by Cloud Run, default 8080) |
| `NODE_ENV` | Backend | `development` or `production` |
| `FRONTEND_URL` | Backend | CORS allowed origin |
| `ENCRYPTION_KEY` | Backend | 64 hex chars (32 bytes) for AES-256-GCM |
| `FIREBASE_SERVICE_ACCOUNT` | Backend | Firebase Admin SDK JSON (stringified) |
| `GCP_PROJECT_ID` | Backend | Google Cloud project ID |
| `GROQ_API_KEY` | Backend | Groq Cloud API key (stored in Secret Manager in prod) |
| `CLOUD_SCHEDULER_SECRET` | Backend | Auth header value for `/api/trigger-insights` |
| `VITE_FIREBASE_API_KEY` | Frontend | Firebase Web SDK |
| `VITE_FIREBASE_AUTH_DOMAIN` | Frontend | Firebase Web SDK |
| `VITE_FIREBASE_PROJECT_ID` | Frontend | Firebase Web SDK |
| `VITE_FIREBASE_STORAGE_BUCKET` | Frontend | Firebase Web SDK |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Frontend | Firebase Web SDK |
| `VITE_FIREBASE_APP_ID` | Frontend | Firebase Web SDK |
| `VITE_FIREBASE_MEASUREMENT_ID` | Frontend | Firebase Analytics (optional) |
| `VITE_API_URL` | Frontend | Backend API base URL |
| `VITE_FIREBASE_VAPID_KEY` | Frontend | FCM push notification VAPID key |

> **Production**: All backend secrets are stored in **Google Cloud Secret Manager** and injected at Cloud Run runtime via `--set-secrets`. Never use `.env` in production.

---

## API Endpoints

Base URL: `https://YOUR_CLOUD_RUN_URL/api`

All endpoints require `Authorization: Bearer <firebase-id-token>` except `/health` and `/api/trigger-insights`.

### `POST /api/parse-sms`
Parse a bank SMS message through the 4-tier AI pipeline.
- **Rate limit**: 10 requests/minute per user
- **Body**: `{ smsText: string, sender?: string }`
- **Response**: `{ amount, merchant, category, confidence, tier, transactionType, paymentMethod }`

### `POST /api/confirm-transaction`
Save a confirmed (or user-edited) transaction to Firestore.
- **Body**: `{ amount, merchant, category, date, paymentMethod, originalSMS?, notes? }`
- **Logic**: Encrypts `amount` with AES-256-GCM → Writes to Firestore → Updates patterns
- **Response**: `{ transactionId, success }`

### `GET /api/transactions`
Fetch and decrypt transactions for the authenticated user.
- **Query**: `?period=month|all&limit=200`
- **Response**: Array of decrypted transaction objects

### `DELETE /api/transactions/:id`
Delete a transaction by ID.

### `PATCH /api/transactions/:id`
Update transaction fields (category, notes, merchant).

### `GET /api/insights`
Get AI-generated financial insights.
- **Query**: `?period=weekly|monthly`
- **Response**: `{ summary, recommendations, trends }`

### `POST /api/chat`
AI finance chatbot via Server-Sent Events streaming.
- **Body**: `{ message: string, conversationHistory: array, context: object }`
- **Response**: SSE stream (`data: {"text": "..."}` → `data: [DONE]`)

### `POST /api/trigger-insights`
Trigger bulk insight generation (Cloud Scheduler only).
- **Auth**: `x-scheduler-secret` header (not Firebase JWT)
- **Body**: `{ period: "weekly" | "monthly" }`

### `GET /health`
Service health check — no auth required.
- **Response**: `{ status: "ok", version, region, timestamp }`

---

## Deployment

### Backend → Google Cloud Run

#### One-time setup

```bash
# Enable required GCP APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com

# Store secrets in Cloud Secret Manager
echo -n "your-groq-api-key" | gcloud secrets create GROQ_API_KEY --data-file=-
echo -n "your-64-hex-encryption-key" | gcloud secrets create ENCRYPTION_KEY --data-file=-
echo -n "your-scheduler-secret" | gcloud secrets create CLOUD_SCHEDULER_SECRET --data-file=-
cat path/to/serviceAccountKey.json | gcloud secrets create FIREBASE_SERVICE_ACCOUNT --data-file=-

# Grant Cloud Build access to secrets
gcloud secrets add-iam-policy-binding GROQ_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
# (repeat for other secrets)
```

#### Deploy via Cloud Build

```bash
# From repo root — triggers cloudbuild.yaml
gcloud builds submit --project=YOUR_PROJECT_ID
```

The pipeline will:
1. Build the Docker image from `backend/Dockerfile`
2. Push to Google Container Registry
3. Deploy to Cloud Run (`asia-south1`, min 0, max 10 instances, 512Mi memory)
4. Inject all secrets from Secret Manager at runtime

### Frontend → Firebase Hosting

```bash
# Install Firebase CLI (if not already)
npm install -g firebase-tools
firebase login

# Build the frontend
cd frontend
npm run build

# Deploy from repo root
cd ..
firebase deploy --only hosting
```

To deploy Firestore rules and hosting together:
```bash
firebase deploy --only firestore,hosting
```

### Cloud Scheduler (run once after Cloud Run is deployed)

```bash
# Set your values and run the setup script
export CLOUD_RUN_URL="https://finhabits-backend-xxxx-el.a.run.app"
export SCHEDULER_SECRET="your_cloud_scheduler_secret"
chmod +x scheduler-setup.sh
./scheduler-setup.sh
```

This creates 3 jobs in `asia-south1`:
| Job | Schedule (IST) | Endpoint |
|---|---|---|
| `finhabits-weekly-insights` | 9 AM every Monday | `POST /api/trigger-insights` |
| `finhabits-monthly-insights` | 9 AM 1st of month | `POST /api/trigger-insights` |
| `finhabits-daily-reminder` | 9 PM daily | `POST /api/send-reminders` |

---

## Security

- **AES-256-GCM** — all financial amounts encrypted at rest in Firestore (never plaintext)
- **Firebase JWT** — every protected API endpoint verifies tokens server-side
- **Cloud Secret Manager** — no secrets in environment files or Docker images in production
- **Non-root container** — backend runs as `finhabits` user inside Docker
- **Rate limiting** — 10 SMS parses/minute per user via `express-rate-limit`
- **Firestore rules** — strict user isolation (users can only access their own data)
- **Raw SMS never stored** — SMS text is discarded after parsing; only structured fields are persisted

---

## PWA Features

- **Web Share Target** — Share a bank SMS from any Android app → FinHabits opens and auto-parses it
- **Push Notifications** — FCM reminders when no transactions logged today (9 PM IST)
- **Offline support** — Workbox caches static assets and Google Fonts (CacheFirst, 1 year TTL)
- **Installable** — Add to Home Screen on Android Chrome and iOS Safari

---

## Confidence Thresholds & AI Tiers

| Threshold | Value | Behaviour |
|---|---|---|
| Tier 0 autofill | ≥5 confirmations | Auto-save, skip all AI tiers |
| High confidence | ≥0.90 | One-tap save prompt |
| Medium confidence | 0.70–0.89 | "Is this correct?" review |
| Low confidence | <0.70 | Full category picker shown |

---

## License

MIT License — see [LICENSE](LICENSE) for details.
