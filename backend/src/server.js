import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import express from 'express';
import { standardLimiter } from './middleware/rateLimit.js';
import parseSMSRouter from './routes/parseSMS.js';
import confirmTransactionRouter from './routes/confirmTransaction.js';
import transactionsRouter from './routes/transactions.js';
import deleteTransactionRouter from './routes/deleteTransaction.js';
import updateTransactionRouter from './routes/updateTransaction.js';

const app = express();
const PORT = process.env.PORT || 8080;

// ─── Core Middleware ──────────────────────────────────────────────────────────

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

// CORS — allow Firebase Hosting origin in production, any origin in dev
app.use((req, res, next) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
  ].filter(Boolean);

  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Apply standard rate limiter to all routes
app.use(standardLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'finhabits-backend',
    timestamp: new Date().toISOString(),
    region: process.env.CLOUD_RUN_REGION || 'local',
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api', parseSMSRouter);
app.use('/api', confirmTransactionRouter);
app.use('/api', transactionsRouter);
app.use('/api', deleteTransactionRouter);
app.use('/api', updateTransactionRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error(`[${new Date().toISOString()}] Unhandled error:`, err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`FinHabits backend running on port ${PORT}`);
});

export default app;

