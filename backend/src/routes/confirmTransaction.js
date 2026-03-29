/**
 * confirmTransaction.js — POST /api/confirm-transaction
 * Encrypts amount, writes to Firestore, updates pattern learning engine.
 */

import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { validate, confirmTransactionSchema } from '../middleware/validate.js';
import { adminDb } from '../firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { updatePattern } from '../services/patternEngine.js';

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

      return res.json({ transactionId: docRef.id, success: true });
    } catch (err) {
      console.error('[confirm-transaction] Error:', err.message);
      return res.status(500).json({ error: 'Failed to save transaction' });
    }
  }
);

export default router;
