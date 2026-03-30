/**
 * insights.js — GET /api/insights?period=weekly|monthly
 *
 * Flow:
 *  1. Fetch user's last 30 days of transactions from Firestore (decrypted)
 *  2. Check if a fresh cached insight exists in Firestore (< 6h old)
 *     → If yes, return it (no Groq call)
 *  3. Build spending context (categories, merchants, day-of-week)
 *  4. Call Groq to generate JSON: { summary, pattern, tip, estimatedSaving }
 *  5. Store result in users/{uid}/insights/{auto-id}
 *  6. Return the insight object
 */

import { Router }    from 'express';
import crypto        from 'crypto';
import Groq          from 'groq-sdk';
import { authenticate } from '../middleware/auth.js';
import { adminDb }   from '../firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

// ── Groq client (lazy) ────────────────────────────────────────────────────────

let groqClient = null;
function getGroq() {
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
}

// ── AES-256-GCM Decrypt (same key as confirmTransaction / transactions routes) ─

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

// ── Spending context builder ───────────────────────────────────────────────────

function buildContext(txns, compareTxns) {
  // Category totals
  const catMap = {};
  let totalSpend = 0;
  for (const t of txns) {
    if (t.transactionType !== 'debit') continue;
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    totalSpend += t.amount;
  }
  const categoryBreakdown = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cat, amt]) => `${cat}: ₹${Math.round(amt)}`)
    .join(', ');

  // Top 3 merchants
  const merchantMap = {};
  for (const t of txns) {
    if (t.transactionType !== 'debit') continue;
    merchantMap[t.merchant] = (merchantMap[t.merchant] || 0) + t.amount;
  }
  const topMerchants = Object.entries(merchantMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m, a]) => `${m} (₹${Math.round(a)})`)
    .join(', ');

  // Day-of-week pattern (IST)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dowMap = {};
  for (const t of txns) {
    if (t.transactionType !== 'debit' || !t.date) continue;
    const d = resolveDate(t.date);
    if (!d) continue;
    const istDay = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getDay();
    dowMap[dayNames[istDay]] = (dowMap[dayNames[istDay]] || 0) + t.amount;
  }
  const dayOfWeekPattern = Object.entries(dowMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day, amt]) => `${day}: ₹${Math.round(amt)}`)
    .join(', ');

  // Period-over-period change
  const compareTotalSpend = compareTxns.reduce((s, t) => t.transactionType === 'debit' ? s + t.amount : s, 0);
  const changePercent = compareTotalSpend > 0
    ? Math.round(((totalSpend - compareTotalSpend) / compareTotalSpend) * 100)
    : 0;

  return {
    totalSpend,
    categoryBreakdown,
    topMerchants,
    dayOfWeekPattern,
    changePercent,
  };
}

// ── Groq prompt builder ───────────────────────────────────────────────────────

function buildInsightPrompt(ctx, period) {
  return `Analyse this user's spending data for the ${period} period:
Total spent: ₹${Math.round(ctx.totalSpend)}
Categories: ${ctx.categoryBreakdown}
vs last period: ${ctx.changePercent > 0 ? '+' : ''}${ctx.changePercent}% change
Top merchants: ${ctx.topMerchants || 'N/A'}
Spending pattern by day: ${ctx.dayOfWeekPattern || 'N/A'}

Generate exactly:
1. One sentence overview (spending vs last period, mention % change and top category)
2. One sentence about the biggest pattern or anomaly you notice
3. One specific actionable tip with estimated monthly savings in ₹

Respond ONLY with valid JSON (no markdown, no code blocks):
{"summary":"...","pattern":"...","tip":"...","estimatedSaving":NUMBER}`;
}

const SYSTEM_PROMPT = `You are a friendly, non-judgmental personal finance advisor for Indian users. You give concise, actionable insights. Always respond with valid JSON only.`;

// ── Fetch + decrypt transactions for a date window ────────────────────────────

async function fetchDebitTxns(uid, from, to) {
  const snap = await adminDb
    .collection('users').doc(uid).collection('transactions')
    .where('date', '>=', from)
    .where('date', '<=', to)
    .orderBy('date', 'desc')
    .limit(300)
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      amount:          safeDecrypt(d.amount),
      merchant:        d.merchant  || 'Unknown',
      category:        d.category  || 'Others',
      transactionType: d.transactionType || 'debit',
      date:            resolveDate(d.date),
    };
  });
}

// ── Main route ────────────────────────────────────────────────────────────────

router.get('/insights', authenticate, async (req, res) => {
  const uid    = req.uid;
  const period = req.query.period === 'monthly' ? 'monthly' : 'weekly';
  const force  = req.query.force === 'true'; // ?force=true bypasses cache

  try {
    // ── 1. Check Firestore cache (insight < 6 hours old) ──────────────────────
    if (!force) {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const cached = await adminDb
        .collection('users').doc(uid).collection('insights')
        .where('period', '==', period)
        .where('generatedAt', '>=', sixHoursAgo)
        .orderBy('generatedAt', 'desc')
        .limit(1)
        .get();

      if (!cached.empty) {
        const doc = cached.docs[0];
        return res.json({ insight: { id: doc.id, ...doc.data() }, cached: true });
      }
    }

    // ── 2. Date windows ───────────────────────────────────────────────────────
    const now    = new Date();
    const days   = period === 'monthly' ? 30 : 7;
    const from   = new Date(now.getTime() - days * 86_400_000);
    const compare_from = new Date(from.getTime() - days * 86_400_000);

    const [currentTxns, compareTxns] = await Promise.all([
      fetchDebitTxns(uid, from, now),
      fetchDebitTxns(uid, compare_from, from),
    ]);

    // ── 3. Guard: not enough data ─────────────────────────────────────────────
    if (currentTxns.length === 0) {
      return res.json({
        insight: {
          summary:        'No transactions found for this period.',
          pattern:        'Add transactions to get personalised insights.',
          tip:            'Start by logging your daily expenses.',
          estimatedSaving: 0,
          period,
          generatedAt:    new Date().toISOString(),
          cached:         false,
        },
        cached: false,
      });
    }

    // ── 4. Build context + call Groq ──────────────────────────────────────────
    const ctx = buildContext(currentTxns, compareTxns);

    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: buildInsightPrompt(ctx, period) },
      ],
      max_tokens:  400,
      temperature: 0.4,
    });

    let jsonStr = (completion.choices[0]?.message?.content || '').trim();
    // Strip possible markdown fences
    jsonStr = jsonStr.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Fallback if model hallucinated non-JSON
      parsed = {
        summary:        jsonStr.slice(0, 200),
        pattern:        'Unable to parse pattern.',
        tip:            'Review your top spending category.',
        estimatedSaving: 0,
      };
    }

    // ── 5. Store in Firestore ─────────────────────────────────────────────────
    const insightDoc = {
      summary:         parsed.summary        || '',
      pattern:         parsed.pattern        || '',
      tip:             parsed.tip            || '',
      estimatedSaving: Number(parsed.estimatedSaving) || 0,
      period,
      totalSpend:      Math.round(ctx.totalSpend),
      changePercent:   ctx.changePercent,
      categoryBreakdown: ctx.categoryBreakdown,
      topMerchants:    ctx.topMerchants,
      generatedAt:     FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb
      .collection('users').doc(uid).collection('insights')
      .add(insightDoc);

    return res.json({
      insight: { id: docRef.id, ...insightDoc, generatedAt: new Date().toISOString() },
      cached: false,
    });

  } catch (err) {
    console.error('[GET /insights] Error:', err.message);
    return res.status(500).json({ error: 'Failed to generate insights' });
  }
});

export default router;
