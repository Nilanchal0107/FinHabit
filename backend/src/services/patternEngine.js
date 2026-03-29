/**
 * patternEngine.js — Tier 0: Temporal Pattern Engine
 * Learns from confirmed transactions and enables 1-tap / instant categorisation.
 */

import { adminDb } from '../firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';

const PATTERN_MIN_OCCURRENCES = 5;

// ── Key generation ────────────────────────────────────────────────────────────

/**
 * Build a stable key from merchant + hour bucket + amount bucket.
 * Hour buckets: morning(0-11), afternoon(12-17), evening(18-23)
 * Amount buckets: 0-100, 101-500, 501-2000, 2001-10000, 10001+
 */
export function generatePatternKey(merchant, timeHour, amount) {
  const slug = merchant.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);

  const hourBucket =
    timeHour < 12 ? 'morning' : timeHour < 18 ? 'afternoon' : 'evening';

  const amountBucket =
    amount <= 100  ? 'xs'  :
    amount <= 500  ? 'sm'  :
    amount <= 2000 ? 'md'  :
    amount <= 10000? 'lg'  : 'xl';

  return `${slug}_${hourBucket}_${amountBucket}`;
}

// ── Fetch all patterns for a user ────────────────────────────────────────────

export async function getPatternMap(userId) {
  const snap = await adminDb
    .collection('users')
    .doc(userId)
    .collection('patterns')
    .get();

  const map = {};
  snap.forEach((doc) => {
    map[doc.id] = doc.data();
  });
  return map;
}

// ── Tier 0 lookup ─────────────────────────────────────────────────────────────

/**
 * Returns a cached result if a matching autofill pattern exists, else null.
 */
export async function tier0Match(userId, extractedData) {
  const { merchant, amount } = extractedData;
  if (!merchant || !amount) return null;

  const hour = new Date().getHours();
  const key = generatePatternKey(merchant, hour, amount);

  const docRef = adminDb
    .collection('users')
    .doc(userId)
    .collection('patterns')
    .doc(key);

  const snap = await docRef.get();
  if (!snap.exists) return null;

  const pattern = snap.data();

  // Only autofill if the pattern has been confirmed enough times
  if (!pattern.autofill || pattern.confirmCount < PATTERN_MIN_OCCURRENCES) {
    return null;
  }

  // Verify amount is within the learned range (±20%)
  const { min = 0, max = Infinity } = pattern.amountRange || {};
  const tolerance = 0.2;
  if (amount < min * (1 - tolerance) || amount > max * (1 + tolerance)) {
    return null;
  }

  return {
    amount,
    merchant: pattern.merchant,
    category: pattern.category,
    transactionType: extractedData.transactionType || 'debit',
    confidence: 1.0,
    tier: 0,
  };
}

// ── Update pattern after confirmation ─────────────────────────────────────────

/**
 * Upsert a pattern document, incrementing confirmCount and updating ranges.
 * Sets autofill: true once confirmCount >= PATTERN_MIN_OCCURRENCES.
 */
export async function updatePattern(userId, merchant, category, amount, transactionType) {
  const hour = new Date().getHours();
  const key = generatePatternKey(merchant, hour, amount);

  const docRef = adminDb
    .collection('users')
    .doc(userId)
    .collection('patterns')
    .doc(key);

  const snap = await docRef.get();

  if (!snap.exists) {
    // First occurrence — create pattern document
    await docRef.set({
      merchant,
      category,
      transactionType,
      confirmCount: 1,
      autofill: false,
      amountRange: { min: amount, max: amount },
      timeWindow: { start: `${hour}:00`, end: `${hour}:59` },
      confidence: 0.5,
      lastSeen: FieldValue.serverTimestamp(),
    });
    return;
  }

  const existing = snap.data();
  const newCount = (existing.confirmCount || 0) + 1;
  const existingMin = existing.amountRange?.min ?? amount;
  const existingMax = existing.amountRange?.max ?? amount;

  await docRef.update({
    confirmCount: FieldValue.increment(1),
    autofill: newCount >= PATTERN_MIN_OCCURRENCES,
    confidence: Math.min(0.5 + newCount * 0.1, 1.0),
    lastSeen: FieldValue.serverTimestamp(),
    'amountRange.min': Math.min(existingMin, amount),
    'amountRange.max': Math.max(existingMax, amount),
    // Update category if user has overridden it consistently
    ...(category !== existing.category && { category }),
  });
}
