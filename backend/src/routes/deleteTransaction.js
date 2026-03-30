/**
 * deleteTransaction.js — DELETE /api/transactions/:id
 * Deletes a transaction owned by the authenticated user.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { adminDb } from '../firebase-admin.js';

const router = Router();

router.delete('/transactions/:id', authenticate, async (req, res) => {
  const userId = req.uid;
  const { id } = req.params;

  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return res.status(400).json({ error: 'Valid transaction ID required' });
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

    await docRef.delete();
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /transactions/:id] Error:', err.message);
    return res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

export default router;
