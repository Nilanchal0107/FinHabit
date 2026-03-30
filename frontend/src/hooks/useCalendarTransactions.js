/**
 * useCalendarTransactions.js
 *
 * Fetches transactions for a specific month (year, month) from the backend.
 * Uses TanStack Query with a [year, month] cache key so navigation between
 * months is instant after the first load.
 *
 * Pre-fetches adjacent months (prev + next) in the background.
 *
 * The backend's period=month filter is calendar-month based, but we need
 * arbitrary month support here, so we fetch period=all and filter client-side.
 * (Avoids adding a new backend endpoint — period=all is already capped at 500.)
 *
 * Returns transactions for the requested [year, month] only.
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@store/authStore.js';
import { fetchAllTransactions } from '@services/api.js';

// ── Query key ─────────────────────────────────────────────────────────────────

export const calendarKey = (uid, year, month) =>
  ['calendar-txns', uid, year, month];

// ── Fetch helper (returns all txns filtered to a given month in IST) ──────────

async function fetchMonthTransactions(year, month) {
  const { transactions } = await fetchAllTransactions();

  return transactions.filter((t) => {
    if (!t.date) return false;
    const d = new Date(t.date);
    // Compare in IST
    const dIST = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    return dIST.getFullYear() === year && dIST.getMonth() === month; // month is 0-indexed
  });
}

// ── Main hook ─────────────────────────────────────────────────────────────────

/**
 * @param {number} year   - Full year, e.g. 2026
 * @param {number} month  - 0-indexed month (0 = January)
 * @returns {{ transactions: object[], isLoading: boolean, error: Error|null }}
 */
export function useCalendarTransactions(year, month) {
  const { user }     = useAuthStore();
  const uid          = user?.uid;
  const queryClient  = useQueryClient();

  // ── Primary query ──────────────────────────────────────────────────────────
  const { data, isLoading, error } = useQuery({
    queryKey:  calendarKey(uid, year, month),
    queryFn:   () => fetchMonthTransactions(year, month),
    enabled:   !!uid,
    staleTime: 60_000,   // 60 s — calendar data doesn't change often
    gcTime:    300_000,  // Keep 5 months of data in cache
  });

  // ── Pre-fetch adjacent months ──────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;

    const prefetch = (y, m) => {
      // Roll month within valid 0-11 range
      let adjY = y, adjM = m;
      if (m < 0)  { adjM = 11; adjY = y - 1; }
      if (m > 11) { adjM = 0;  adjY = y + 1; }

      queryClient.prefetchQuery({
        queryKey: calendarKey(uid, adjY, adjM),
        queryFn:  () => fetchMonthTransactions(adjY, adjM),
        staleTime: 60_000,
      });
    };

    prefetch(year, month - 1); // previous month
    prefetch(year, month + 1); // next month
  }, [uid, year, month, queryClient]);

  return {
    transactions: data ?? [],
    isLoading,
    error: error ?? null,
  };
}
