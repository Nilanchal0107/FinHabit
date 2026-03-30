/**
 * Transactions.jsx — Full history view (Prompt 6)
 *
 * Architecture:
 *  - useAllTransactions()  → fetches all decrypted txns (up to 500) via TanStack Query
 *  - FuzzySearch           → Fuse.js search across merchant/category/amount/notes
 *  - CategoryFilter        → multi-select chips + date range presets / custom picker
 *  - TransactionList       → date-grouped rows w/ IntersectionObserver infinite scroll
 *  - TransactionDetails    → full-screen edit/delete modal
 *
 * Infinite scroll is client-side virtual pages (PAGE_SIZE = 20).
 * All amounts come pre-decrypted from the backend — never shown encrypted.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { useUIStore } from '@store/uiStore.js';
import { useAllTransactions } from '@hooks/useAllTransactions.js';
import { deleteTransaction } from '@services/api.js';

import FuzzySearch       from '@components/transactions/FuzzySearch.jsx';
import CategoryFilter    from '@components/transactions/CategoryFilter.jsx';
import TransactionList   from '@components/transactions/TransactionList.jsx';
import TransactionDetails from '@components/transactions/TransactionDetails.jsx';

// ── constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ── delete confirmation dialog ────────────────────────────────────────────────

function DeleteDialog({ txn, onConfirm, onCancel, deleting }) {
  return (
    <AnimatePresence>
      {txn && (
        <>
          <motion.div
            key="del-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          />
          <motion.div
            key="del-dialog"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-sm rounded-3xl border border-white/10 p-6 space-y-5 pointer-events-auto"
              style={{ backgroundColor: '#16162A' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Icon */}
              <div className="flex justify-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ backgroundColor: 'rgba(244,63,94,0.12)' }}
                >
                  🗑️
                </div>
              </div>

              {/* Copy */}
              <div className="text-center space-y-1">
                <h3 className="font-heading text-lg font-bold text-text-primary">Delete Transaction?</h3>
                <p className="font-body text-sm text-text-secondary">
                  <span className="text-text-primary font-semibold">{txn.merchant}</span> will be permanently removed.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 rounded-2xl font-body text-sm border border-white/10 text-text-secondary hover:text-text-primary transition-colors"
                  style={{ backgroundColor: '#0F0F1A' }}
                  id="delete-dialog-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-2xl font-body text-sm font-semibold text-white transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#F43F5E' }}
                  id="delete-dialog-confirm"
                >
                  {deleting
                    ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : 'Delete'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="px-4 md:px-6 space-y-4 animate-pulse pt-4">
      <div className="h-11 rounded-2xl bg-white/8" />
      <div className="flex gap-2">
        {[1,2,3,4,5].map((i) => <div key={i} className="h-8 w-20 rounded-full bg-white/8 flex-shrink-0" />)}
      </div>
      <div className="space-y-2 pt-2">
        {[1,2,3,4,5,6].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ backgroundColor: '#16162A' }}>
            <div className="w-10 h-10 rounded-xl bg-white/10" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 rounded bg-white/10 w-2/5" />
              <div className="h-2.5 rounded bg-white/10 w-1/3" />
            </div>
            <div className="h-4 w-16 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ transactions }) {
  const { totalDebit, totalCredit, count } = useMemo(() => {
    let d = 0, c = 0;
    for (const t of transactions) {
      if (t.transactionType === 'debit') d += t.amount;
      else c += t.amount;
    }
    return { totalDebit: d, totalCredit: c, count: transactions.length };
  }, [transactions]);

  const fmt = (n) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0, notation: count > 100 ? 'compact' : 'standard',
  }).format(n);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-body"
      style={{ backgroundColor: '#16162A' }}
    >
      <span className="text-text-secondary">{count} {count === 1 ? 'result' : 'results'}</span>
      <span className="w-px h-3 bg-white/10 flex-shrink-0" />
      <span style={{ color: '#F43F5E' }}>Out {fmt(totalDebit)}</span>
      <span className="w-px h-3 bg-white/10 flex-shrink-0" />
      <span style={{ color: '#22C55E' }}>In {fmt(totalCredit)}</span>
    </motion.div>
  );
}

// ── date filtering helper ─────────────────────────────────────────────────────

function inDateRange(txn, range) {
  if (!range?.start || !range?.end) return true;
  const d = new Date(txn.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
  return d >= range.start && d <= range.end;
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Transactions() {
  const { user }      = useAuthStore();
  const { addToast }  = useUIStore();
  const uid           = user?.uid;

  // ─── data ──────────────────────────────────────────────────────────────────
  const { transactions: allTxns, isLoading } = useAllTransactions();

  // ─── category icons from Firestore ─────────────────────────────────────────
  const [categoryIcons, setCategoryIcons] = useState({});
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      collection(db, 'users', uid, 'categories'),
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => { const data = d.data(); map[data.name] = data.icon || '💳'; });
        setCategoryIcons(map);
      },
      () => {}
    );
    return () => unsub();
  }, [uid]);

  // ─── filter state ──────────────────────────────────────────────────────────
  const [searchResults,       setSearchResults]       = useState(null); // null = no active search
  const [selectedCategories,  setSelectedCategories]  = useState([]);
  const [dateRange,           setDateRange]           = useState(null);

  // ─── virtual pagination ────────────────────────────────────────────────────
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [searchResults, selectedCategories, dateRange]);

  // ─── filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let base = searchResults !== null ? searchResults : allTxns;

    if (selectedCategories.length > 0) {
      base = base.filter((t) => selectedCategories.includes(t.category));
    }
    if (dateRange) {
      base = base.filter((t) => inDateRange(t, dateRange));
    }

    // Sort newest first
    return [...base].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [allTxns, searchResults, selectedCategories, dateRange]);

  const hasMore   = visibleCount < filtered.length;
  const hasFilters = searchResults !== null || selectedCategories.length > 0 || !!dateRange;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((n) => Math.min(n + PAGE_SIZE, filtered.length));
  }, [filtered.length]);

  const clearFilters = useCallback(() => {
    setSearchResults(null);
    setSelectedCategories([]);
    setDateRange(null);
  }, []);

  // ─── details modal ─────────────────────────────────────────────────────────
  const [detailsTxn, setDetailsTxn] = useState(null);

  const handleTap = useCallback((txn) => setDetailsTxn(txn), []);

  const handleDetailsClose = useCallback(() => setDetailsTxn(null), []);

  const handleDetailsUpdated = useCallback((updated) => {
    setDetailsTxn(null);
  }, []);

  // ─── swipe-delete flow ─────────────────────────────────────────────────────
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting,      setDeleting]      = useState(false);

  const handleDeleteRequest = useCallback((txn) => setPendingDelete(txn), []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteTransaction(pendingDelete.id);
      addToast({ type: 'success', title: 'Deleted', message: `${pendingDelete.merchant} removed` });
    } catch (err) {
      addToast({ type: 'error', title: 'Delete failed', message: err.message });
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }, [pendingDelete, deleting, addToast]);

  // ─── render ────────────────────────────────────────────────────────────────

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: '6rem' }}>

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 px-4 pt-4 pb-3 md:hidden"
        style={{
          background: 'rgba(15,15,26,0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <h1 className="font-heading text-base font-bold text-text-primary mb-3">Transactions</h1>
        <FuzzySearch transactions={allTxns} onResults={setSearchResults} />
      </header>

      {/* ── Desktop heading ─────────────────────────────────────────────────── */}
      <div className="hidden md:block px-6 pt-6 pb-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-heading text-2xl font-bold text-text-primary">Transactions</h1>
        </div>
        <FuzzySearch transactions={allTxns} onResults={setSearchResults} />
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div
        className="sticky z-20 px-4 md:px-6 py-3"
        style={{
          top: '0',
          background: 'rgba(15,15,26,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {/* On mobile: top already has search, so just show filter row */}
        <CategoryFilter
          selectedCategories={selectedCategories}
          onCategoriesChange={setSelectedCategories}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* ── Summary strip ───────────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 py-2">
        <AnimatePresence mode="wait">
          {filtered.length > 0 && (
            <SummaryStrip key={filtered.length} transactions={filtered} />
          )}
        </AnimatePresence>
      </div>

      {/* ── Transaction list ────────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 pt-1">
        <TransactionList
          transactions={filtered}
          categoryIcons={categoryIcons}
          visibleCount={visibleCount}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          onTap={handleTap}
          onDeleteRequest={handleDeleteRequest}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
        />
      </div>

      {/* ── Transaction details modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {detailsTxn && (
          <TransactionDetails
            key={detailsTxn.id}
            txn={detailsTxn}
            categoryIcon={categoryIcons[detailsTxn.category]}
            onClose={handleDetailsClose}
            onDeleted={() => { setDetailsTxn(null); }}
            onUpdated={handleDetailsUpdated}
          />
        )}
      </AnimatePresence>

      {/* ── Swipe-delete confirmation dialog ─────────────────────────────────── */}
      <DeleteDialog
        txn={pendingDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
        deleting={deleting}
      />
    </div>
  );
}
