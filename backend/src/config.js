/**
 * config.js — Centralised environment variable access.
 *
 * Google Cloud Secret Manager values often include trailing newlines (\n).
 * This module trims ALL secret values once at startup so every other module
 * can import clean, validated config without worrying about whitespace.
 *
 * dotenv is loaded here for local development. In Cloud Run production,
 * the .env file doesn't exist — env vars are injected by Secret Manager.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
try {
  // Only runs in local dev — silently ignored if .env doesn't exist
  require('dotenv').config({ path: './.env' });
} catch {
  // dotenv not available in some environments — safe to skip
}

function trimEnv(key) {
  return (process.env[key] || '').trim();
}

export const config = {
  PORT:                     parseInt(process.env.PORT, 10) || 8080,
  NODE_ENV:                 trimEnv('NODE_ENV') || 'development',
  GCP_PROJECT_ID:           trimEnv('GCP_PROJECT_ID'),
  ENCRYPTION_KEY:           trimEnv('ENCRYPTION_KEY'),
  GROQ_API_KEY:             trimEnv('GROQ_API_KEY'),
  SCHEDULER_SECRET:         trimEnv('SCHEDULER_SECRET') || trimEnv('CLOUD_SCHEDULER_SECRET'),
  FRONTEND_URL:             trimEnv('FRONTEND_URL'),
  FIREBASE_SERVICE_ACCOUNT: trimEnv('FIREBASE_SERVICE_ACCOUNT'),
};
