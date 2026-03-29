import { create } from 'zustand';

/**
 * Transaction store — holds local transaction list and pending SMS parse result.
 * Firestore reads are handled via useFirestore hook; this store caches the data.
 */
export const useTransactionStore = create((set) => ({
  transactions: [],
  pendingParse: null, // Result from /api/parse-sms before user confirms
  loading: false,
  error: null,

  setTransactions: (transactions) => set({ transactions }),

  addTransaction: (transaction) =>
    set((state) => ({
      transactions: [transaction, ...state.transactions],
    })),

  updateTransaction: (transactionId, updates) =>
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === transactionId ? { ...t, ...updates } : t
      ),
    })),

  removeTransaction: (transactionId) =>
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== transactionId),
    })),

  setPendingParse: (result) => set({ pendingParse: result }),

  clearPendingParse: () => set({ pendingParse: null }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),
}));
