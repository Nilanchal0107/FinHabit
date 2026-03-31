/**
 * notifications.js — Frontend FCM notification service
 *
 * requestNotificationPermission → gets FCM token → saves to Firestore
 * setupFCMListeners             → handles foreground messages as in-app toasts
 */

import { doc, updateDoc } from 'firebase/firestore';
import { db, messaging, requestNotificationPermission as getPermissionAndToken, onForegroundMessage } from './firebase.js';
import { useUIStore } from '@store/uiStore.js';

// ── Notification type → app route mapping (mirrors SW) ───────────────────────
const NOTIFICATION_ROUTES = {
  DAILY_REMINDER:  '/dashboard',
  WEEKLY_SUMMARY:  '/insights',
  MONTHLY_REPORT:  '/insights',
  ANOMALY_ALERT:   '/transactions',
};

// ── Foreground toast icons per type ──────────────────────────────────────────
const NOTIFICATION_ICONS = {
  DAILY_REMINDER:  '🔥',
  WEEKLY_SUMMARY:  '📊',
  MONTHLY_REPORT:  '📅',
  ANOMALY_ALERT:   '⚠️',
};

/**
 * Request browser notification permission, obtain FCM token,
 * and persist it to users/{uid}/profile/fcmToken in Firestore.
 *
 * @param {string} uid  - Firebase Auth user ID
 * @returns {Promise<{ granted: boolean, token: string|null }>}
 */
export async function requestNotificationPermission(uid) {
  if (!('Notification' in window)) {
    console.warn('[FCM] Notifications not supported in this browser.');
    return { granted: false, token: null };
  }

  if (!messaging) {
    console.warn('[FCM] Firebase Messaging not available.');
    return { granted: false, token: null };
  }

  try {
    const token = await getPermissionAndToken();

    if (!token) {
      return { granted: false, token: null };
    }

    // Persist token to Firestore so backend can reach this device
    if (uid) {
      await updateDoc(doc(db, 'users', uid, 'profile', 'data'), {
        fcmToken: token,
      });
    }

    console.log('[FCM] Token registered:', token.slice(0, 20) + '…');
    return { granted: true, token };
  } catch (err) {
    console.error('[FCM] Permission/token error:', err.message);
    return { granted: false, token: null };
  }
}

/**
 * Listen for foreground FCM messages and display them as in-app toast
 * notifications (not browser notifications, since the app is focused).
 *
 * @returns {Function} Unsubscribe function — call on logout/cleanup.
 */
export function setupFCMListeners() {
  const unsubscribe = onForegroundMessage((payload) => {
    console.log('[FCM] Foreground message received:', payload);

    const { addToast } = useUIStore.getState();
    const data         = payload.data || {};
    const notifType    = data.type || '';
    const icon         = NOTIFICATION_ICONS[notifType] || '🔔';

    const title   = payload.notification?.title || 'FinHabits';
    const body    = payload.notification?.body  || '';
    const route   = NOTIFICATION_ROUTES[notifType] || '/dashboard';

    addToast({
      type:     'info',
      title:    `${icon} ${title}`,
      message:  body,
      duration: 6000,
      // route stored for future click-to-navigate support
      _route:   route,
    });
  });

  return unsubscribe;
}
