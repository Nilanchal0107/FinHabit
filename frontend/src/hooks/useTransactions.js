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

import { useEffect } from 'react';
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
    queryKey:  txnKeys.period(uid, period),
    queryFn:   () => fetchTransactions(period).then((res) => res.transactions),
    enabled:   !!uid,
    staleTime: 30_000,  // 30 s — short because Firestore invalidates anyway
  });

  // ─── 2. Firestore onSnapshot — fires when Firestore changes → invalidate cache ─

  useEffect(() => {
    if (!uid) return;

    // Watch the latest 1 doc (cheapest read) just to detect any change
    const q = query(
      collection(db, 'users', uid, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsub = onSnapshot(
      q,
      () => {
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
