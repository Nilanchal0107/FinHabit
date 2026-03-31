import admin from 'firebase-admin';
import { config } from './config.js';

let adminApp;

/**
 * Initialise Firebase Admin SDK exactly once.
 * In production (Cloud Run), FIREBASE_SERVICE_ACCOUNT is injected
 * from Cloud Secret Manager as a JSON string.
 */
const initFirebaseAdmin = () => {
  if (admin.apps.length) {
    return admin.apps[0];
  }

  const serviceAccount = JSON.parse(config.FIREBASE_SERVICE_ACCOUNT);

  adminApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: config.GCP_PROJECT_ID,
  });

  return adminApp;
};

initFirebaseAdmin();

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export { admin };
