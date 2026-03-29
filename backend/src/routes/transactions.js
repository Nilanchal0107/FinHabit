/**
 * transactions.js — GET /api/transactions
 *
 * Fetches the authenticated user's transactions from Firestore,
 * decrypts the AES-256-GCM encrypted `amount` field, and returns
 * plaintext amounts safe for the frontend to use.
 *
 * Query params:
 *   period  'month' (default) | 'all'
 *   limit   max documents (default 200, hard cap 500)
 */

import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { adminDb } from '../firebase-admin.js';

const router = Router();

// ── AES-256-GCM Decrypt (mirrors encrypt in confirmTransaction.js) ─────────────

function decrypt(encryptedText) {
  const [ivHex, authTagHex, dataHex] = encryptedText.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Malformed ciphertext');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.get('/transactions', authenticate, async (req, res) => {
  const userId = req.uid;

  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
    return res.status(500).json({ error: 'Encryption key not configured' });
  }

  try {
    const limitCount = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const period = req.query.period || 'month';

    let query = adminDb
      .collection('users')
      .doc(userId)
      .collection('transactions')
      .orderBy('date', 'desc')
      .limit(limitCount);

    // Filter to current calendar month when period=month
    if (period === 'month') {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      query = query
        .where('date', '>=', monthStart)
        .where('date', '<=', monthEnd);
    }

    const snapshot = await query.get();

    const transactions = snapshot.docs.map((doc) => {
      const data = doc.data();
      let amount = 0;

      // Decrypt amount — gracefully fall back to 0 on any error
      try {
        const raw = decrypt(data.amount);
        amount = parseFloat(raw);
        if (isNaN(amount)) amount = 0;
      } catch {
        amount = 0;
      }

      return {
        id:              doc.id,
        amount,                              // ← plaintext number, safe for frontend
        merchant:        data.merchant  || 'Unknown',
        category:        data.category  || 'Others',
        transactionType: data.transactionType || 'debit',
        paymentMethod:   data.paymentMethod   || 'UPI',
        date:            data.date?.toDate?.()?.toISOString() || null,
        confidence:      data.confidence  ?? 0,
        parsingTier:     data.parsingTier ?? 1,
        notes:           data.notes       || null,
        createdAt:       data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    return res.json({ transactions, count: transactions.length });
  } catch (err) {
    console.error('[GET /transactions] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

export default router;
