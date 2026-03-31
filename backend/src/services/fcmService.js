/**
 * fcmService.js — Backend FCM notification helper
 *
 * Provides sendNotification() and notification template builders.
 * Uses Firebase Admin SDK (messaging) — no API key needed, uses IAM auth.
 */

import { admin } from '../firebase-admin.js';
import { adminDb } from '../firebase-admin.js';

// ── Lazy messaging instance ───────────────────────────────────────────────────

let _messaging = null;
function getMessaging() {
  if (!_messaging) _messaging = admin.messaging();
  return _messaging;
}

// ── Notification preference keys ─────────────────────────────────────────────

const PREF_MAP = {
  DAILY_REMINDER: 'notifyDaily',
  WEEKLY_SUMMARY: 'notifyWeekly',
  MONTHLY_REPORT: 'notifyMonthly',
  ANOMALY_ALERT:  'notifyLargeSpend',
};

/**
 * Fetch a user's FCM token and check their notification preference
 * for a given notification type.
 *
 * @param {string} uid
 * @param {string} type - One of DAILY_REMINDER | WEEKLY_SUMMARY | MONTHLY_REPORT | ANOMALY_ALERT
 * @returns {Promise<string|null>} FCM token or null if disabled/missing
 */
async function getTokenForUser(uid, type) {
  try {
    const profileSnap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('profile')
      .doc('data')
      .get();

    if (!profileSnap.exists) return null;

    const profile = profileSnap.data();
    const prefKey = PREF_MAP[type];

    // If the user has explicitly disabled this notification type, skip
    if (prefKey && profile.notificationPrefs?.[prefKey] === false) {
      return null;
    }
    // Also check top-level prefs written by onboarding (notifyWeekly etc.)
    if (prefKey && profile[prefKey] === false) {
      return null;
    }

    return profile.fcmToken || null;
  } catch (err) {
    console.error(`[FCM] getTokenForUser(${uid}) error:`, err.message);
    return null;
  }
}

/**
 * Send a single push notification to a specific user.
 *
 * @param {string} uid
 * @param {{ title: string, body: string, type: string }} notification
 * @returns {Promise<boolean>} true if sent successfully
 */
export async function sendNotification(uid, { title, body, type }) {
  const token = await getTokenForUser(uid, type);

  if (!token) {
    console.log(`[FCM] Skipping notification for ${uid} — no token or pref disabled`);
    return false;
  }

  const message = {
    token,
    notification: { title, body },
    data: { type },
    android: {
      notification: {
        icon:         'ic_notification',
        color:        '#4F46E5',
        channelId:    'finhabits-default',
        clickAction:  'FLUTTER_NOTIFICATION_CLICK',
      },
      priority: 'high',
    },
    apns: {
      payload: {
        aps: {
          badge: 1,
          sound: 'default',
        },
      },
    },
    webpush: {
      notification: {
        icon:  '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        requireInteraction: false,
      },
      fcmOptions: {
        link: '/',
      },
    },
  };

  try {
    await getMessaging().send(message);
    console.log(`[FCM] ✓ Sent ${type} notification to uid ${uid}`);
    return true;
  } catch (err) {
    // If the token is stale/invalid, remove it from Firestore
    if (
      err.code === 'messaging/registration-token-not-registered' ||
      err.code === 'messaging/invalid-registration-token'
    ) {
      console.warn(`[FCM] Stale token for ${uid} — removing from Firestore`);
      await adminDb
        .collection('users')
        .doc(uid)
        .collection('profile')
        .doc('data')
        .update({ fcmToken: null })
        .catch(() => {});
    } else {
      console.error(`[FCM] Send failed for ${uid}:`, err.message);
    }
    return false;
  }
}

// ── Notification template builders ───────────────────────────────────────────

/**
 * DAILY_REMINDER — sent to users with no transactions today.
 */
export function buildDailyReminder() {
  return {
    title: 'FinHabits',
    body:  "Log today's expenses — don't break your streak! 🔥",
    type:  'DAILY_REMINDER',
  };
}

/**
 * WEEKLY_SUMMARY — sent after weekly insights are generated.
 * @param {number} amount - Total weekly spend in INR
 */
export function buildWeeklySummary(amount) {
  return {
    title: 'Your week in review',
    body:  `You spent ₹${Math.round(amount).toLocaleString('en-IN')} this week. Tap to see insights.`,
    type:  'WEEKLY_SUMMARY',
  };
}

/**
 * ANOMALY_ALERT — fires after a transaction that is >2× average daily spend.
 * @param {number} amount
 * @param {string} merchant
 * @param {number} multiplier - e.g. 3.2 for 3.2× average
 */
export function buildAnomalyAlert(amount, merchant, multiplier) {
  return {
    title: 'Unusual expense detected',
    body:  `₹${Math.round(amount).toLocaleString('en-IN')} at ${merchant} — ${multiplier.toFixed(1)}× your usual spend`,
    type:  'ANOMALY_ALERT',
  };
}

/**
 * MONTHLY_REPORT — sent on 1st of every month.
 * @param {number} total - Total monthly spend in INR
 * @param {string} month - e.g. "March"
 */
export function buildMonthlyReport(total, month) {
  const monthLabel = month || new Date().toLocaleString('en-IN', { month: 'long' });
  return {
    title: `${monthLabel} summary ready`,
    body:  `You spent ₹${Math.round(total).toLocaleString('en-IN')}. Tap to see your monthly breakdown.`,
    type:  'MONTHLY_REPORT',
  };
}
