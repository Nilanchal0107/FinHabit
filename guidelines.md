# FinHabits — AI Guidelines File
# Read this file before writing ANY code. Follow every rule strictly.

---

## PROJECT IDENTITY
Name: FinHabits
Type: AI-powered, semi-automated personal finance PWA
Target: Indian users who receive bank SMS notifications
Goal: Parse bank SMS → Extract transaction → AI categorise → User confirms in 1 tap → Learn patterns → Generate insights
Hackathon: Google Solution Challenge 2026 — Open Innovation Track

---

## TECH STACK — NEVER DEVIATE FROM THIS

### Frontend (Firebase Hosting)
- React 18 with Vite (NOT Create React App, NOT Next.js)
- Tailwind CSS (NOT styled-components, NOT CSS modules)
- Zustand (NOT Redux, NOT Context API alone)
- TanStack Query / React Query (NOT SWR)
- Recharts (NOT Chart.js, NOT D3)
- Framer Motion (NOT React Spring, NOT plain CSS animations)
- Vite PWA Plugin (for service workers + Web Share Target)
- React Router v6 (NOT React Router v5)
- Fuse.js (for fuzzy search in Transactions tab)

### Backend (Google Cloud Run)
- Node.js 20 LTS with Express.js
- Firebase Admin SDK (for JWT verification)
- Zod (for all request validation — NOT Joi, NOT Yup)
- express-rate-limit (rate limiting middleware)
- Node.js built-in crypto (AES-256-GCM ONLY — NOT CBC, NOT third-party)
- Native fetch() (NOT Axios — Node 20 has fetch built in)

### Database & Auth
- Firebase Firestore (NOT MongoDB, NOT PostgreSQL)
- Firebase Authentication (Google Sign-In + Phone OTP)
- Firebase Hosting (frontend deployment)
- Firebase Cloud Messaging (push notifications)
- Firebase Remote Config (feature flags + confidence thresholds)
- Firebase Analytics (usage tracking)

### AI Services
- Groq Cloud — Llama 3.1 70B (Tier 2 parsing + chatbot + insights)
- Google Vertex AI — Gemini 1.5 Flash (Tier 3 fallback ONLY)

### DevOps
- Google Cloud Run (serverless, min 0, max 10 instances)
- Google Cloud Scheduler (weekly/monthly insight triggers)
- Google Cloud Secret Manager (ALL secrets stored here)
- Google Cloud Build (CI/CD pipeline)

---

## FONTS — CRITICAL
- Headings: Syne (Google Fonts) — font-weight 700/800
- Body text: DM Sans (Google Fonts) — font-weight 400/500
- Monospace / amounts: DM Mono
- NEVER use Inter, Roboto, or system fonts

---

## COLOR SYSTEM — USE EXACT VALUES
```
Primary Indigo:   #4F46E5
Violet:           #7C3AED
Teal (backend):   #0D9488
Amber (db/auth):  #F59E0B
Coral (AI):       #F43F5E
Background dark:  #0F0F1A
Surface dark:     #16162A
Success:          #22C55E
Text primary:     #F0EFF8
Text secondary:   #8B8A9E
```

Color coding — use consistently:
- Purple = Frontend layer
- Teal = Backend layer
- Amber = Database / Auth layer
- Coral = AI layer

---

## FIRESTORE STRUCTURE — EXACT SCHEMA
```
users/{uid}/
├── profile/
│   ├── name (string)
│   ├── email (string)
│   ├── phone (string)
│   ├── city (string)
│   ├── state (string)
│   ├── monthlyIncome (string — AES-256-GCM encrypted)
│   ├── employmentType (string: Salaried|Freelancer|Business|Student)
│   ├── salaryDate (number: 1-31)
│   ├── primaryBanks (array of strings)
│   ├── upiApps (array of strings)
│   ├── language (string)
│   └── createdAt (timestamp)
│
├── transactions/{transactionId}/
│   ├── amount (string — AES-256-GCM encrypted)
│   ├── merchant (string)
│   ├── category (string)
│   ├── transactionType (string: debit|credit)
│   ├── paymentMethod (string: UPI|Card|Cash|NetBanking)
│   ├── date (timestamp)
│   ├── confidence (number: 0.0-1.0)
│   ├── parsingTier (number: 0|1|2|3)
│   ├── notes (string, optional)
│   └── createdAt (timestamp)
│
├── budgets/{categoryId}/
│   ├── limit (string — AES-256-GCM encrypted)
│   ├── rollover (boolean)
│   └── updatedAt (timestamp)
│
├── patterns/{patternKey}/
│   ├── merchant (string)
│   ├── category (string)
│   ├── timeWindow (object: {start: string, end: string})
│   ├── amountRange (object: {min: number, max: number})
│   ├── confirmCount (number)
│   ├── autofill (boolean — true when confirmCount >= 5)
│   ├── confidence (number)
│   └── lastSeen (timestamp)
│
├── insights/{insightId}/
│   ├── type (string: weekly|monthly)
│   ├── summary (string)
│   ├── recommendations (array of strings)
│   ├── periodStart (timestamp)
│   ├── periodEnd (timestamp)
│   └── generatedAt (timestamp)
│
└── categories/{categoryId}/
    ├── name (string)
    ├── color (string: hex)
    ├── icon (string: emoji)
    ├── isDefault (boolean)
    └── order (number)
```

---

## API ENDPOINTS — EXACT SIGNATURES

```
POST /api/parse-sms
  Auth: Firebase JWT (required)
  Body: { smsText: string, sender?: string }
  Rate limit: 10 per minute per user
  Logic: Tier 0 → Tier 1 → Tier 2 → Tier 3
  Response: { amount, merchant, category, confidence, tier, transactionType }

POST /api/confirm-transaction
  Auth: Firebase JWT (required)
  Body: { amount, merchant, category, date, paymentMethod, originalSMS?, notes? }
  Logic: Encrypt amount (AES-256-GCM) → Write Firestore → Update patterns
  Response: { transactionId, success }

GET /api/insights
  Auth: Firebase JWT (required)
  Query: { period: 'weekly' | 'monthly' }
  Logic: Fetch transactions → Groq prompt → Return insights
  Response: { summary, recommendations, trends }

POST /api/chat
  Auth: Firebase JWT (required)
  Body: { message: string, conversationHistory: array, context: object }
  Logic: Assemble context → Stream Groq response via SSE
  Response: Server-Sent Events stream

POST /api/trigger-insights
  Auth: x-scheduler-secret header (NOT Firebase JWT)
  Validation: req.headers['x-scheduler-secret'] === process.env.CLOUD_SCHEDULER_SECRET
  Logic: Generate weekly/monthly insights for all users
  Called by: Google Cloud Scheduler
```

---

## 4-TIER PARSING LOGIC — EXACT ORDER

```
Tier 0: Temporal Pattern Engine
  → Check users/{uid}/patterns in Firestore
  → If pattern.confirmCount >= 5 AND merchant+time+amount match
  → Return immediately with confidence: 1.0, tier: 0
  → SKIP all other tiers

Tier 1: Regex Engine
  → Run 20+ Indian bank regex patterns
  → Speed: ~50ms, free, no API call
  → If confidence > 0.9 → Return immediately, tier: 1
  → If confidence < 0.9 → Fall through to Tier 2

Tier 2: Groq Llama 3.1 70B
  → Use exact system + user prompt from prompts.js
  → Include 2 few-shot examples
  → Use chain-of-thought: "Think step by step..."
  → Speed: ~800ms
  → If confidence > 0.7 → Return, tier: 2
  → If confidence < 0.7 → Fall through to Tier 3

Tier 3: Vertex AI Gemini 1.5 Flash
  → Use @google-cloud/vertexai SDK
  → Authenticate via IAM (NO API key needed)
  → Always returns a result, tier: 3
```

---

## SECURITY RULES — NON-NEGOTIABLE

1. NEVER store raw SMS text in Firestore or any logs
2. ALWAYS use AES-256-GCM (NOT CBC) for encryption
3. ALWAYS verify Firebase JWT on every protected endpoint
4. ALWAYS store secrets in Cloud Secret Manager (NOT .env in production)
5. NEVER hardcode API keys anywhere in code
6. ALWAYS apply rate limiting: 10 SMS parses per user per minute
7. Firestore security rules: users can only read/write their own documents

---

## ENCRYPTION — EXACT IMPLEMENTATION

```javascript
// ALWAYS use GCM, NEVER use CBC
const encrypt = (text) => {
  const iv = crypto.randomBytes(12); // 12 bytes for GCM
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
    iv
  );
  const encrypted = Buffer.concat([cipher.update(text.toString(), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
};

const decrypt = (encryptedText) => {
  const [ivHex, authTagHex, dataHex] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
};
```

---

## GROQ STREAMING — EXACT IMPLEMENTATION

```javascript
// POST /api/chat — always use this exact pattern
const stream = await groq.chat.completions.create({
  model: 'llama-3.1-70b-versatile',
  messages: assembledMessages,
  stream: true,
  max_tokens: 500,
  temperature: 0.7
});

res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

for await (const chunk of stream) {
  const text = chunk.choices[0]?.delta?.content || '';
  if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
}
res.write('data: [DONE]\n\n');
res.end();
```

---

## REQUIRED ENVIRONMENT VARIABLES

```
# Cloud Secret Manager keys (injected at Cloud Run runtime)
GROQ_API_KEY=                    # Groq Cloud API key
GCP_PROJECT_ID=                  # Google Cloud project ID
ENCRYPTION_KEY=                  # 64 hex chars (32 bytes) for AES-256-GCM
CLOUD_SCHEDULER_SECRET=          # Random 32-char string for /api/trigger-insights
FIREBASE_SERVICE_ACCOUNT=        # Firebase Admin SDK JSON (stringified)

# These are set automatically by Cloud Run (no action needed)
PORT=8080
```

---

## CLOUD RUN CONFIGURATION

```
Min instances: 0 (scale to zero)
Max instances: 10
Memory: 512MB
CPU: 1
Concurrency: 80
Region: asia-south1 (Mumbai — data localisation for India)
```

---

## CLOUD SCHEDULER JOBS

```
Weekly insights:  0 9 * * MON   (9 AM every Monday)
Monthly insights: 0 9 1 * *     (9 AM on 1st of every month)
```

---

## CONFIDENCE THRESHOLDS (from Firebase Remote Config)

```
AUTOFILL_THRESHOLD: 0.90       (Tier 0 pattern autofill)
HIGH_CONFIDENCE: 0.90          (one-tap save)
MEDIUM_CONFIDENCE: 0.70        (Is this correct? prompt)
LOW_CONFIDENCE: < 0.70         (full category picker)
PATTERN_MIN_OCCURRENCES: 5     (minimum before autofill activates)
```

---

## DO NOT — EVER

- Do NOT use Axios — use native fetch() or SDK methods
- Do NOT use AES-256-CBC — use GCM only
- Do NOT store raw SMS text in Firestore or logs
- Do NOT use Inter font — use Syne + DM Sans
- Do NOT use Redux — use Zustand
- Do NOT use Next.js — use React + Vite
- Do NOT use MongoDB — use Firestore
- Do NOT hardcode API keys — use Cloud Secret Manager
- Do NOT use node-cron — use Google Cloud Scheduler
- Do NOT leave placeholder comments like "add logic here"
- Do NOT use polling for chatbot — use Server-Sent Events
- Do NOT use WebSockets — use SSE for streaming
- Do NOT skip error handling on any async operation
- Do NOT skip loading states on any data fetch
- Do NOT skip empty states on any list component