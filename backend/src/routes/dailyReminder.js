/**
 * dailyReminder.js — POST /api/daily-reminder
 *
 * Called ONLY by Cloud Scheduler at 0 21 * * * (9 PM IST daily).
 * Validates x-scheduler-secret header.
 *
 * Logic:
 *  1. Fetch all user document refs.
 *  2. For each user, check if they have ANY transaction created today.
 *  3. If no transaction today → send DAILY_REMINDER FCM notification.
 *
 * This route is NOT callable from the frontend.
 */

import { Router }     from 'express';
import { adminDb }    from '../firebase-admin.js';
import { sendNotification, buildDailyReminder } from '../services/fcmService.js';

const router = Router();

router.post('/daily-reminder', async (req, res) => {
  // ── Authenticate Cloud Scheduler request ───────────────────────────────────
  const secret = req.headers['x-scheduler-secret'];
  if (!secret || secret !== process.env.SCHEDULER_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Start of today in UTC (approx — adjust if IST offset matters for your users)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  let sent    = 0;
  let skipped = 0;
  let errors  = 0;

  try {
    const userRefs = await adminDb.collection('users').listDocuments();

    // Process in batches of 10 to avoid overwhelming FCM / Firestore
    const BATCH = 10;
    for (let i = 0; i < userRefs.length; i += BATCH) {
      const batch = userRefs.slice(i, i + BATCH);

      await Promise.all(
        batch.map(async (userRef) => {
          try {
            // Check if user already logged a transaction today
            const todaySnap = await adminDb
              .collection('users')
              .doc(userRef.id)
              .collection('transactions')
              .where('createdAt', '>=', todayStart)
              .limit(1)
              .get();

            if (!todaySnap.empty) {
              skipped++;
              return; // User already logged today — skip
            }

            // No transaction today → send reminder
            const ok = await sendNotification(userRef.id, buildDailyReminder());
            if (ok) sent++;
            else skipped++;
          } catch (err) {
            console.error(`[daily-reminder] Failed for uid ${userRef.id}:`, err.message);
            errors++;
          }
        })
      );
    }

    return res.json({ success: true, sent, skipped, errors });
  } catch (err) {
    console.error('[POST /daily-reminder] Error:', err.message);
    return res.status(500).json({ error: 'Daily reminder trigger failed' });
  }
});

export default router;
