/**
 * triggerInsights.js — POST /api/trigger-insights
 *
 * Called ONLY by Cloud Scheduler every Monday 9 AM IST.
 * Validates x-scheduler-secret header, then generates a weekly insight
 * for every user who has at least one transaction in the last 7 days.
 *
 * This route is NOT callable from the frontend.
 */

import { Router }    from 'express';
import crypto        from 'crypto';
import Groq          from 'groq-sdk';
import { adminDb }   from '../firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { sendNotification, buildWeeklySummary, buildMonthlyReport } from '../services/fcmService.js';

const router = Router();

// ── Groq client (lazy) ────────────────────────────────────────────────────────

let groqClient = null;
function getGroq() {
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
}

// ── AES-256-GCM Decrypt ───────────────────────────────────────────────────────

function safeDecrypt(enc) {
  try {
    const [ivHex, authTagHex, dataHex] = enc.split(':');
    if (!ivHex || !authTagHex || !dataHex) return 0;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
    return parseFloat(plain) || 0;
  } catch {
    return 0;
  }
}

function resolveDate(val) {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string') return new Date(val);
  return null;
}

// ── Generate insight for a single user ───────────────────────────────────────

async function generateForUser(uid, period = 'weekly') {
  const now  = new Date();
  const from = new Date(now.getTime() - 7 * 86_400_000);
  const comparefrom = new Date(from.getTime() - 7 * 86_400_000);

  // Fetch current + previous week
  const fetchTxns = async (start, end) => {
    const snap = await adminDb
      .collection('users').doc(uid).collection('transactions')
      .where('date', '>=', start)
      .where('date', '<=', end)
      .limit(200)
      .get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        amount:          safeDecrypt(data.amount),
        merchant:        data.merchant  || 'Unknown',
        category:        data.category  || 'Others',
        transactionType: data.transactionType || 'debit',
        date:            resolveDate(data.date),
      };
    });
  };

  const [cur, prev] = await Promise.all([
    fetchTxns(from, now),
    fetchTxns(comparefrom, from),
  ]);

  if (cur.length === 0) return null;

  // Build context
  const catMap = {};
  let total = 0;
  for (const t of cur) {
    if (t.transactionType !== 'debit') continue;
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    total += t.amount;
  }
  const prevTotal = prev.reduce((s, t) => t.transactionType === 'debit' ? s + t.amount : s, 0);
  const changePercent = prevTotal > 0
    ? Math.round(((total - prevTotal) / prevTotal) * 100)
    : 0;

  const catBreakdown = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([c, a]) => `${c}: ₹${Math.round(a)}`).join(', ');

  const merchantMap = {};
  for (const t of cur) {
    if (t.transactionType !== 'debit') continue;
    merchantMap[t.merchant] = (merchantMap[t.merchant] || 0) + t.amount;
  }
  const topMerchants = Object.entries(merchantMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([m, a]) => `${m} (₹${Math.round(a)})`).join(', ');

  const prompt = `Analyse this user's spending for the past week:
Total spent: ₹${Math.round(total)}
Categories: ${catBreakdown}
vs last week: ${changePercent > 0 ? '+' : ''}${changePercent}% change
Top merchants: ${topMerchants || 'N/A'}
Generate exactly: summary, pattern, tip, estimatedSaving.
Respond ONLY with valid JSON (no markdown): {"summary":"...","pattern":"...","tip":"...","estimatedSaving":NUMBER}`;

  const completion = await getGroq().chat.completions.create({
    model:       'llama-3.3-70b-versatile',
    messages:    [
      { role: 'system', content: 'You are a friendly Indian personal finance advisor. Reply only with JSON.' },
      { role: 'user',   content: prompt },
    ],
    max_tokens:  350,
    temperature: 0.4,
  });

  let jsonStr = (completion.choices[0]?.message?.content || '').trim()
    .replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  let parsed;
  try { parsed = JSON.parse(jsonStr); }
  catch { parsed = { summary: 'Weekly insight generated.', pattern: '', tip: '', estimatedSaving: 0 }; }

  await adminDb.collection('users').doc(uid).collection('insights').add({
    summary:          parsed.summary        || '',
    pattern:          parsed.pattern        || '',
    tip:              parsed.tip            || '',
    estimatedSaving:  Number(parsed.estimatedSaving) || 0,
    period,
    totalSpend:       Math.round(total),
    changePercent,
    categoryBreakdown: catBreakdown,
    topMerchants,
    generatedAt:      FieldValue.serverTimestamp(),
  });

  // Send FCM notification with the total spend
  const notification =
    period === 'monthly'
      ? buildMonthlyReport(total, now.toLocaleString('en-IN', { month: 'long' }))
      : buildWeeklySummary(total);

  await sendNotification(uid, notification);

  return { sent: true, total: Math.round(total) };
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post('/trigger-insights', async (req, res) => {
  // Validate secret header
  const secret = req.headers['x-scheduler-secret'];
  if (!secret || secret !== process.env.SCHEDULER_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Determine period from optional query/body param (default: weekly)
  const period = (req.body?.period || req.query?.period || 'weekly').toLowerCase();
  const validPeriods = ['weekly', 'monthly'];
  const insightPeriod = validPeriods.includes(period) ? period : 'weekly';

  try {
    // Get all users who have at least one transaction
    const usersSnap = await adminDb.collection('users').listDocuments();
    let processed = 0;
    let errors    = 0;

    // Process in batches of 5 to avoid overwhelming Groq rate limits
    const BATCH = 5;
    for (let i = 0; i < usersSnap.length; i += BATCH) {
      const batch = usersSnap.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (userRef) => {
          try {
            const result = await generateForUser(userRef.id, insightPeriod);
            if (result?.sent) processed++;
          } catch (err) {
            console.error(`[trigger-insights] Failed for uid ${userRef.id}:`, err.message);
            errors++;
          }
        })
      );
    }

    return res.json({ success: true, period: insightPeriod, processed, errors });
  } catch (err) {
    console.error('[POST /trigger-insights] Error:', err.message);
    return res.status(500).json({ error: 'Trigger failed' });
  }
});

export default router;
