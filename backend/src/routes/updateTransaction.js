/**
 * updateTransaction.js — PATCH /api/transactions/:id
 * Updates category and/or notes. Feeds the pattern engine when
 * the category is changed so the user's corrections are learned.
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { adminDb } from '../firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { updatePattern } from '../services/patternEngine.js';

const router = Router();

const updateSchema = z.object({
  category: z.string().min(1).max(60).optional(),
  notes: z.string().max(500).nullable().optional(),
});

router.patch('/transactions/:id', authenticate, async (req, res) => {
  const userId = req.uid;
  const { id } = req.params;

  const result = updateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0]?.message || 'Invalid data' });
  }

  const { category, notes } = result.data;

  if (!category && notes === undefined) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  try {
    const docRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('transactions')
      .doc(id);

    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const old = snap.data();
    const update = { updatedAt: FieldValue.serverTimestamp() };
    if (category) update.category = category;
    if (notes !== undefined) update.notes = notes ?? '';

    await docRef.update(update);

    // Feed pattern engine when user corrects the category
    if (category && old.category !== category && old.merchant) {
      updatePattern(userId, old.merchant, category, null, old.transactionType || 'debit').catch(
        (err) => console.error('[updatePattern] Non-fatal:', err.message)
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[PATCH /transactions/:id] Error:', err.message);
    return res.status(500).json({ error: 'Failed to update transaction' });
  }
});

export default router;
