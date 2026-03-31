/**
* firebase-messaging-sw.js
* Service worker for Firebase Cloud Messaging background notifications.
*
* Firebase config is loaded from /firebase-sw-config.js (served by Vite plugin
* in dev, emitted as a static asset in production build).
*/

// Firebase SDK — must match version used in the main app
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Load Firebase config injected by Vite build (see vite.config.js swEnvInjector plugin)
// self.FIREBASE_SW_CONFIG is set by /firebase-sw-config.js
importScripts('/firebase-sw-config.js');

firebase.initializeApp(self.FIREBASE_SW_CONFIG || {});

const messaging = firebase.messaging();

// ── Notification route map ────────────────────────────────────────────────────
const NOTIFICATION_ROUTES = {
  DAILY_REMINDER: '/dashboard',
  WEEKLY_SUMMARY: '/insights',
  MONTHLY_REPORT: '/insights',
  ANOMALY_ALERT: '/transactions',
};

// ── Background message handler ────────────────────────────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background FCM message received:', payload);

  const { title, body } = payload.notification || {};
  const data = payload.data || {};
  const notifType = data.type || 'DAILY_REMINDER';
  const route = NOTIFICATION_ROUTES[notifType] || '/dashboard';

  const notifOptions = {
    body: body || 'Tap to open FinHabits',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag: notifType,       // collapses duplicate notifications of same type
    renotify: false,
    data: {
      url: route,
      type: notifType,
    },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    vibrate: [200, 100, 200],
  };

  return self.registration.showNotification(title || 'FinHabits', notifOptions);
});

// ── Notification click handler ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/dashboard';
  const fullUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus and navigate existing tab if app is already open
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.navigate(fullUrl);
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});
