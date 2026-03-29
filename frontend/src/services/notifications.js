import { messaging, requestNotificationPermission, onForegroundMessage } from './firebase.js';
import { useUIStore } from '@store/uiStore.js';

/**
 * Initialize FCM: request permission, get token, listen for foreground messages.
 * Call this after the user has signed in.
 *
 * @returns {Promise<string|null>} FCM token
 */
export const initNotifications = async () => {
  const token = await requestNotificationPermission();

  if (token) {
    onForegroundMessage((payload) => {
      const { addToast } = useUIStore.getState();
      addToast({
        type: 'info',
        title: payload.notification?.title || 'FinHabits',
        message: payload.notification?.body || '',
      });
    });
  }

  return token;
};

export { messaging };
