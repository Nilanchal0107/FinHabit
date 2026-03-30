/**
 * chat.js — POST /api/chat (SSE streaming)
 *
 * Flow:
 *  1. Authenticate user via Firebase JWT
 *  2. Fetch user profile (income, budget limits) from Firestore
 *  3. Fetch last 50 transactions, calculate per-category spend + remaining
 *  4. Build rich system prompt with full financial context
 *  5. Stream Groq response token-by-token via SSE (res.write)
 *
 * SSE format:
 *   data: {"token":"word "}\n\n        — incremental tokens
 *   data: [DONE]\n\n                   — stream complete
 */

import { Router } from 'express';
import crypto from 'crypto';
import Groq from 'groq-sdk';
import { authenticate } from '../middleware/auth.js';
import { chatLimiter } from '../middleware/rateLimit.js';
import { adminDb } from '../firebase-admin.js';

const router = Router();

// ── Groq client (lazy singleton) ──────────────────────────────────────────────

let groqClient = null;
function getGroq() {
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
}

// ── AES-256-GCM Decrypt (same key used across all routes) ─────────────────────

function decrypt(enc) {
  const [ivHex, authTagHex, dataHex] = enc.split(':');
  if (!ivHex || !authTagHex || !dataHex) throw new Error('Malformed ciphertext');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

function safeDecrypt(enc) {
  try { return parseFloat(decrypt(enc)) || 0; } catch { return 0; }
}

function resolveDate(val) {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string') return new Date(val);
  return null;
}

// ── Context assembly ──────────────────────────────────────────────────────────

async function assembleContext(uid) {
  // 1. Fetch user profile
  let income = 0;
  let monthlyBudget = 0;
  let budgetLimits = {};
  let userName = 'there';

  try {
    const profileSnap = await adminDb
      .collection('users').doc(uid).collection('profile').doc('data')
      .get();

    if (profileSnap.exists) {
      const profile = profileSnap.data();
      income = Number(profile.income) || 0;
      monthlyBudget = Number(profile.monthlyBudget) || income;
      budgetLimits = profile.budgetLimits || {};
      userName = profile.name || 'there';
    }
  } catch (err) {
    console.error('[Chat] Profile fetch error:', err.message);
  }

  // 2. Fetch last 50 transactions
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let transactions = [];

  try {
    const txnSnap = await adminDb
      .collection('users').doc(uid).collection('transactions')
      .orderBy('date', 'desc')
      .limit(50)
      .get();

    transactions = txnSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        amount: safeDecrypt(d.amount),
        merchant: d.merchant || 'Unknown',
        category: d.category || 'Others',
        transactionType: d.transactionType || 'debit',
        date: resolveDate(d.date),
      };
    });
  } catch (err) {
    console.error('[Chat] Transactions fetch error:', err.message);
  }

  // 3. Calculate category spend this month
  const categorySpend = {};
  let totalSpent = 0;

  for (const txn of transactions) {
    if (txn.transactionType !== 'debit') continue;
    if (txn.date && txn.date >= monthStart) {
      categorySpend[txn.category] = (categorySpend[txn.category] || 0) + txn.amount;
      totalSpent += txn.amount;
    }
  }

  // 4. Category breakdown string
  const categoryBreakdown = Object.entries(categorySpend)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `${cat}: ₹${Math.round(amt)}`)
    .join(', ') || 'No spending data yet';

  // 5. Budget remaining per category
  const budgetRemaining = {};
  for (const [cat, spent] of Object.entries(categorySpend)) {
    const limit = budgetLimits[cat] || 0;
    if (limit > 0) {
      budgetRemaining[cat] = Math.max(0, limit - spent);
    }
  }
  const budgetRemainingStr = Object.entries(budgetRemaining)
    .map(([cat, rem]) => `${cat}: ₹${Math.round(rem)} left`)
    .join(', ') || 'No category budgets set';

  // 6. Top merchant today
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayMerchants = {};
  for (const txn of transactions) {
    if (txn.transactionType !== 'debit') continue;
    if (txn.date && txn.date >= todayStart) {
      todayMerchants[txn.merchant] = (todayMerchants[txn.merchant] || 0) + txn.amount;
    }
  }
  const topMerchant = Object.entries(todayMerchants)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None yet';

  // 7. Days left in month
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate();

  // 8. Safe to spend today
  const budgetRemTotal = Math.max(0, monthlyBudget - totalSpent);
  const safeToSpend = daysLeft > 0 ? Math.round(budgetRemTotal / daysLeft) : budgetRemTotal;

  // 9. Day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames[now.getDay()];

  return {
    userName,
    income,
    totalSpent: Math.round(totalSpent),
    monthlyBudget,
    categoryBreakdown,
    budgetRemainingStr,
    topMerchant,
    daysLeft,
    safeToSpend,
    dayOfWeek,
    currentDate: now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(ctx, activeTab) {
  const tabContext = activeTab
    ? `\nThe user is currently viewing the "${activeTab}" tab in the app.`
    : '';

  return `You are FinHabits AI — a friendly personal finance assistant for Indian users. You have access to the user's financial data:

Monthly income: ₹${ctx.income}
This month's spending: ₹${ctx.totalSpent} of ₹${ctx.monthlyBudget} budget
Category breakdown: ${ctx.categoryBreakdown}
Budget remaining: ${ctx.budgetRemainingStr}
Top merchant today: ${ctx.topMerchant}
Days left in month: ${ctx.daysLeft}
Safe to spend today: ₹${ctx.safeToSpend}
Current date: ${ctx.currentDate} (${ctx.dayOfWeek})
${tabContext}

Guidelines:
- Answer questions concisely. Use ₹ for all amounts.
- Be encouraging, not judgmental.
- If asked to show data, describe it in text.
- Keep responses under 150 words unless asked for detail.
- Use simple language. Avoid jargon.
- When the user asks about spending, reference actual data above.
- Greet the user as "${ctx.userName}" if it's the first message.`;
}

// ── POST /api/chat (SSE streaming) ────────────────────────────────────────────

router.post('/chat', authenticate, chatLimiter, async (req, res) => {
  const uid = req.uid;
  const { message, conversationHistory = [], context = {} } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (message.length > 1000) {
    return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
  }

  // ── Set up SSE headers ──────────────────────────────────────────────────────
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable Nginx buffering
  });

  try {
    // ── Assemble financial context ────────────────────────────────────────────
    const financialCtx = await assembleContext(uid);
    const systemPrompt = buildSystemPrompt(financialCtx, context.activeTab);

    // ── Build messages array ──────────────────────────────────────────────────
    // Include last 10 conversation turns to stay within token limits
    const recentHistory = conversationHistory.slice(-10).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: message.trim() },
    ];

    // ── Stream from Groq ──────────────────────────────────────────────────────
    const stream = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 500,
      temperature: 0.6,
      stream: true,
    });

    // Handle client disconnect
    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    for await (const chunk of stream) {
      if (clientDisconnected) break;

      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    // Signal completion
    if (!clientDisconnected) {
      res.write('data: [DONE]\n\n');
    }

    res.end();
  } catch (err) {
    console.error('[POST /chat] Error:', err.message);

    // If headers already sent (SSE started), send error as SSE event
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: 'An error occurred while generating response' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      res.status(500).json({ error: 'Failed to process chat request' });
    }
  }
});

export default router;
