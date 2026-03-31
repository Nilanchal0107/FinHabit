/**
 * confirmTransaction.js — POST /api/confirm-transaction
 * Encrypts amount, writes to Firestore, updates pattern learning engine.
 * Includes anomaly detection: fires FCM alert if spend >2× 30-day average.
 */

import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { validate, confirmTransactionSchema } from '../middleware/validate.js';
import { adminDb } from '../firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { updatePattern } from '../services/patternEngine.js';
import { sendNotification, buildAnomalyAlert } from '../services/fcmService.js';

const router = Router();

// ── AES-256-GCM Encryption (exact implementation from guidelines) ─────────────

function encrypt(text) {
  const iv = crypto.randomBytes(12); // 12 bytes for GCM
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
    iv
  );
  const encrypted = Buffer.concat([
    cipher.update(text.toString(), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return (
    iv.toString('hex') +
    ':' +
    authTag.toString('hex') +
    ':' +
    encrypted.toString('hex')
  );
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post(
  '/confirm-transaction',
  authenticate,
  validate(confirmTransactionSchema),
  async (req, res) => {
    const userId = req.uid;
    const {
      amount,
      merchant,
      category,
      date,
      paymentMethod,
      notes,
      transactionType = 'debit',
    } = req.body;

    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
      return res.status(500).json({ error: 'Encryption key not configured' });
    }

    try {
      // 1. Encrypt the amount (AES-256-GCM)
      const encryptedAmount = encrypt(String(amount));

      // 2. Build transaction document (matches Firestore schema from guidelines)
      const transactionData = {
        amount:          encryptedAmount,
        merchant:        merchant.trim(),
        category,
        transactionType,
        paymentMethod,
        date:            typeof date === 'string' ? new Date(date) : new Date(date),
        confidence:      req.body.confidence || 0,
        parsingTier:     req.body.parsingTier || 1,
        createdAt:       FieldValue.serverTimestamp(),
        ...(notes ? { notes: notes.trim() } : {}),
      };

      // 3. Write to users/{uid}/transactions/{auto-id}
      const docRef = await adminDb
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .add(transactionData);

      // 4. Update temporal pattern learning engine (non-blocking)
      updatePattern(userId, merchant, category, amount, transactionType).catch((err) => {
        console.error('[updatePattern] Non-fatal error:', err.message);
      });

      // 5. Anomaly detection — non-blocking, runs in background
      if (transactionType === 'debit') {
        detectAnomaly(userId, docRef.id, amount, merchant).catch((err) => {
          console.error('[anomaly-detection] Non-fatal error:', err.message);
        });
      }

      return res.json({ transactionId: docRef.id, success: true });
    } catch (err) {
      console.error('[confirm-transaction] Error:', err.message);
      return res.status(500).json({ error: 'Failed to save transaction' });
    }
  }
);

// ── Anomaly Detection ─────────────────────────────────────────────────────────

/**
 * Fetch the user's average DAILY debit spend over the last 30 days.
 * Compare against the new transaction amount.
 * If amount > 2× average → send FCM alert + flag the transaction.
 *
 * @param {string} userId
 * @param {string} transactionId - Newly created Firestore doc ID
 * @param {number} amount        - Plaintext transaction amount
 * @param {string} merchant
 */
async function detectAnomaly(userId, transactionId, amount, merchant) {
  const ANOMALY_MULTIPLIER = 2;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const snap = await adminDb
    .collection('users')
    .doc(userId)
    .collection('transactions')
    .where('transactionType', '==', 'debit')
    .where('date', '>=', thirtyDaysAgo)
    .limit(300)
    .get();

  if (snap.empty) return; // No history — skip

  // Decrypt and sum all debit transactions from last 30 days
  let total30 = 0;
  const decryptKey = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    try {
      const enc = data.amount || '';
      const [ivHex, authTagHex, dataHex] = enc.split(':');
      if (!ivHex || !authTagHex || !dataHex) continue;
      const decipher = crypto.createDecipheriv('aes-256-gcm', decryptKey, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
      const plain = Buffer.concat([
        decipher.update(Buffer.from(dataHex, 'hex')),
        decipher.final(),
      ]).toString('utf8');
      const val = parseFloat(plain);
      if (!isNaN(val)) total30 += val;
    } catch {
      // Skip undecryptable entries
    }
  }

  // Average daily spend (30 days)
  const avgDaily = total30 / 30;

  if (avgDaily <= 0) return; // No meaningful baseline

  const multiplier = amount / avgDaily;

  if (multiplier >= ANOMALY_MULTIPLIER) {
    // Flag the transaction in Firestore
    await adminDb
      .collection('users')
      .doc(userId)
      .collection('transactions')
      .doc(transactionId)
      .update({ isAnomaly: true });

    // Send FCM notification
    await sendNotification(
      userId,
      buildAnomalyAlert(amount, merchant, multiplier)
    );

    console.log(`[anomaly-detection] Alert sent to ${userId} — ₹${amount} at ${merchant} (${multiplier.toFixed(1)}× avg)`);
  }
}

export default router;
