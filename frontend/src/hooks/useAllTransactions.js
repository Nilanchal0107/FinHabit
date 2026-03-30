/**
 * useAllTransactions.js
 *
 * Fetches ALL of a user's transactions (up to 500) from the decryption endpoint.
 * Includes a Firestore onSnapshot watcher that invalidates the cache on any change,
 * so new transactions appear instantly in the Transactions page.
 *
 * Returns the full list — filtering, search, and virtual pagination are done
 * client-side in the Transactions page component.
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { fetchAllTransactions } from '@services/api.js';

// Shared query key so dashboard + transactions page cache invalidations align
export const ALL_TXN_KEY = (uid) => ['transactions', uid, 'all'];

export function useAllTransactions() {
  const { user } = useAuthStore();
  const uid = user?.uid;
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey:  ALL_TXN_KEY(uid),
    queryFn:   () => fetchAllTransactions().then((res) => res.transactions),
    enabled:   !!uid,
    staleTime: 30_000,
  });

  // Firestore watcher — invalidate on any transaction write
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const unsub = onSnapshot(
      q,
      () => queryClient.invalidateQueries({ queryKey: ['transactions', uid] }),
      (err) => console.warn('[useAllTransactions] watcher error:', err.message)
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
