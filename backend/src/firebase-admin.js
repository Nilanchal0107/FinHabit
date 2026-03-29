import dotenv from "dotenv";
dotenv.config();

import admin from 'firebase-admin';

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

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  adminApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.GCP_PROJECT_ID,
  });

  return adminApp;
};

initFirebaseAdmin();

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export { admin };
