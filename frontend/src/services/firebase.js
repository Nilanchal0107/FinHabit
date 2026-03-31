import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  PhoneAuthProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  connectAuthEmulator,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getAnalytics } from 'firebase/analytics';
import { getRemoteConfig } from 'firebase/remote-config';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Prevent duplicate app initialization (HMR-safe)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Messaging is only available in browser (not SSR/service worker context)
let messaging = null;
try {
  messaging = getMessaging(app);
} catch {
  // Firebase Messaging not supported in this environment
}
export { messaging };

// Analytics (only in production browser context)
let analytics = null;
if (typeof window !== 'undefined' && import.meta.env.PROD) {
  analytics = getAnalytics(app);
}
export { analytics };

// Remote Config
export const remoteConfig = getRemoteConfig(app);

// Auth providers
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const phoneProvider = new PhoneAuthProvider(auth);

// Connect to emulators in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8081);
}

/**
 * Sign in with Google using popup.
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export const signInWithGoogle = async () => {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential;
};

/**
 * Sign in with phone number using invisible reCAPTCHA.
 * @param {string} phoneNumber - E.164 format, e.g. "+919876543210"
 * @param {import('firebase/auth').ApplicationVerifier} appVerifier - RecaptchaVerifier instance
 * @returns {Promise<import('firebase/auth').ConfirmationResult>}
 */
export const signInWithPhone = async (phoneNumber, appVerifier) => {
  const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  return confirmationResult;
};

/**
 * Sign out the current user.
 */
export const signOut = async () => {
  await firebaseSignOut(auth);
};

/**
 * Request FCM notification permission and return token.
 * @returns {Promise<string|null>} FCM token or null if permission denied.
 */
export const requestNotificationPermission = async () => {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });
    return token;
  } catch {
    return null;
  }
};

/**
 * Listen for foreground FCM messages.
 * @param {Function} callback - Receives message payload.
 * @returns {Function} Unsubscribe function.
 */
export const onForegroundMessage = (callback) => {
  if (!messaging) return () => { };
  return onMessage(messaging, callback);
};
