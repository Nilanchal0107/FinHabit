# FinHabits

FinHabits is a full-stack personal finance app that helps users track spending from bank SMS messages.

It includes:
- A React + Vite frontend for dashboarding, transaction management, and insights.
- A Node.js + Express backend that parses SMS text with a tiered AI pipeline and stores transactions in Firestore.
- Firebase Auth-based authentication and secure backend APIs.

## Monorepo Structure

```text
Finhabits/
├─ backend/    # Express API, SMS parser pipeline, Firestore writes/reads
└─ frontend/   # React app (Vite + Tailwind + Zustand + React Query)
```

## Tech Stack

### Frontend
- React 18
- Vite 5
- Tailwind CSS
- Zustand
- TanStack React Query
- Firebase Web SDK
- Recharts

### Backend
- Node.js 20+
- Express 4
- Firebase Admin SDK
- Zod validation
- Groq SDK (Llama 3.1 70B)
- Google Vertex AI SDK (Gemini 1.5 Flash)

## How It Works (SMS Parsing Pipeline)

The backend parses SMS text using a multi-tier strategy:
1. Tier 1 regex parsing for speed and structured extraction.
2. Tier 0 temporal pattern matching using user history (if Tier 1 gives usable signal).
3. Tier 2 Groq fallback for medium-confidence regex outcomes.
4. Tier 3 Vertex AI fallback as last resort.

The final parsed result is confirmed by the user and then stored.

## Prerequisites

- Node.js 20 or newer
- npm 9+
- Firebase project with Auth + Firestore enabled
- Groq API key (for tier 2 parser)
- Google Cloud project with Vertex AI access (for tier 3 parser)

## Setup

Install dependencies in both apps:

```bash
cd backend
npm install

cd ../frontend
npm install
```

## Environment Variables

### Backend (`backend/.env`)

```env
# Server
PORT=8080
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Security (64-char hex key for AES-256-GCM)
ENCRYPTION_KEY=your_64_character_hex_key

# Firebase Admin
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
GCP_PROJECT_ID=your-gcp-project-id

# AI providers
GROQ_API_KEY=your-groq-api-key

# Optional (used in health response on cloud)
CLOUD_RUN_REGION=asia-south1
```

Notes:
- `ENCRYPTION_KEY` must be exactly 64 hex characters.
- `FIREBASE_SERVICE_ACCOUNT` is expected as JSON string.

### Frontend (`frontend/.env`)

```env
# API base URL (defaults to /api if omitted)
VITE_API_URL=http://localhost:8080/api

# Firebase Web SDK config
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...

# Optional
VITE_FIREBASE_VAPID_KEY=...
VITE_USE_EMULATORS=false
```

## Run Locally

Run backend:

```bash
cd backend
npm run dev
```

Run frontend (in another terminal):

```bash
cd frontend
npm run dev
```

Default local URLs:
- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:8080/health`

## Available Scripts

### Backend
- `npm run dev` - start backend with file watch
- `npm start` - start backend in normal mode

### Frontend
- `npm run dev` - start Vite dev server
- `npm run build` - production build
- `npm run preview` - preview production build locally
- `npm run lint` - run ESLint

## API Endpoints (Current)

Base URL: `/api`

- `POST /api/parse-sms`
  - Auth required (Firebase ID token)
  - Body: `{ smsText, sender? }`
  - Returns parsed transaction fields (`amount`, `merchant`, `category`, `transactionType`, `paymentMethod`, `confidence`, `tier`).

- `POST /api/confirm-transaction`
  - Auth required
  - Persists transaction to Firestore
  - Encrypts amount using AES-256-GCM before storing

- `GET /api/transactions?period=month|all&limit=200`
  - Auth required
  - Returns decrypted transactions for client display

- `GET /health`
  - Service health/status endpoint

## Authentication

All protected backend endpoints require:

```http
Authorization: Bearer <firebase-id-token>
```

The frontend obtains this token from the current Firebase-authenticated user and sends it automatically.

## Security Notes

- Raw SMS text is not persisted by parser routes.
- Transaction amount is encrypted at rest with AES-256-GCM.
- API uses request validation (Zod) and rate limiting middleware.

## Deployment Notes

A production Dockerfile is provided for the backend at `backend/Dockerfile`:
- Multi-stage build
- Non-root runtime user
- Built-in healthcheck for `/health`
- Suitable for Cloud Run-style deployments

## Troubleshooting

- 401 Unauthorized:
  - Ensure the user is signed in and Firebase token is valid.
- 500 Encryption key not configured:
  - Verify backend `ENCRYPTION_KEY` exists and has 64 hex chars.
- SMS parse fallback behavior:
  - If regex and Groq confidence are low, Vertex AI fallback is used.

## License

Add your preferred license here.
