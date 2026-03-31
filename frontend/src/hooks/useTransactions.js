/**
 * useTransactions.js
 *
 * Central data hook used by ALL dashboard components.
 *
 * Strategy:
 *  1. TanStack Query fetches transactions from GET /api/transactions (decrypted amounts)
 *  2. Firestore onSnapshot watches for new/changed docs → invalidates the query cache
 *     → TanStack Query refetches automatically → dashboard updates in real-time
 *
 * This gives us:
 *  - Correct decrypted amounts ✓
 *  - Real-time updates via Firestore push ✓
 *  - Shared cache — only ONE API call regardless of how many components mount ✓
 */

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { fetchTransactions } from '@services/api.js';

// ── Query key factory ─────────────────────────────────────────────────────────

export const txnKeys = {
  all:    (uid)         => ['transactions', uid],
  month:  (uid)         => ['transactions', uid, 'month'],
  period: (uid, period) => ['transactions', uid, period],
};

// ── Main hook ─────────────────────────────────────────────────────────────────

/**
 * @param {'month'|'all'} [period='month']
 * @returns {{ transactions: object[], isLoading: boolean, error: Error|null, refetch: Function }}
 */
export function useTransactions(period = 'month') {
  const { user } = useAuthStore();
  const uid = user?.uid;
  const queryClient = useQueryClient();

  // ─── 1. TanStack Query — fetches decrypted transactions from the backend API ──

  const { data, isLoading, error, refetch } = useQuery({
    queryKey:   txnKeys.period(uid, period),
    queryFn:    () => fetchTransactions(period).then((res) => res.transactions),
    enabled:    !!uid,
    staleTime:  30_000,  // 30 s — short because Firestore invalidates anyway
    retry:      1,       // Only 1 retry on failure (default 3 floods the network)
    retryDelay: 3_000,   // Wait 3 s before retrying
  });

  // ─── 2. Firestore onSnapshot — fires when Firestore changes → invalidate cache ─

  // Track whether the INITIAL snapshot has been received.
  // onSnapshot fires once immediately on connection with the current state.
  // We skip THAT first emit because TanStack Query already fetches on mount —
  // duplicating it causes a redundant network call. We only invalidate on
  // SUBSEQUENT real-time changes.
  const initialSnapshotRef = useRef(false);

  useEffect(() => {
    if (!uid) return;
    initialSnapshotRef.current = false;

    // Watch the latest 1 doc (cheapest possible read) to detect any change
    const q = query(
      collection(db, 'users', uid, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsub = onSnapshot(
      q,
      () => {
        if (!initialSnapshotRef.current) {
          // Skip the very first (connection-time) snapshot — TanStack Query's
          // initial fetch already covers this. Mark as received and return.
          initialSnapshotRef.current = true;
          return;
        }
        // A doc was added/modified/removed → invalidate so TanStack refetches
        queryClient.invalidateQueries({ queryKey: txnKeys.all(uid) });
      },
      (err) => {
        console.warn('[useTransactions] Firestore watcher error:', err.message);
      }
    );

    return () => unsub();
  }, [uid, queryClient]);

  return {
    transactions: data ?? [],
    isLoading,
    error: error ?? null,
    refetch,
  };
}
