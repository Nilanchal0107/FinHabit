/**
 * TransactionList.jsx
 * Groups transactions by date with sticky headers.
 * IntersectionObserver sentinel drives infinite scroll (client-side virtual pages).
 */

import { useMemo, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import TransactionItem from './TransactionItem.jsx';

// ── date label helper ─────────────────────────────────────────────────────────

function dateLabel(dateStr) {
  if (!dateStr) return 'Unknown date';
  const d = new Date(dateStr);

  // Compare as IST calendar dates (YYYY-MM-DD strings) to avoid timezone issues
  const dIST   = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const todayIST     = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const yday         = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  if (dIST === todayIST) return 'Today';
  if (dIST === yday)     return 'Yesterday';

  // Within last 7 days → weekday name
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diffDays < 7) {
    return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long' });
  }
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── group helper ──────────────────────────────────────────────────────────────

function groupByDate(transactions) {
  const map = new Map();
  for (const txn of transactions) {
    const key = txn.date
      ? new Date(txn.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
      : 'unknown';
    if (!map.has(key)) map.set(key, { key, label: dateLabel(txn.date), date: txn.date, items: [] });
    map.get(key).items.push(txn);
  }
  return [...map.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ── empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 gap-4"
    >
      <div className="text-6xl select-none">{hasFilters ? '🔍' : '💸'}</div>
      <div className="text-center space-y-1.5 max-w-xs">
        <p className="font-heading text-base font-bold text-text-primary">
          {hasFilters ? 'No transactions found' : 'No transactions yet'}
        </p>
        <p className="font-body text-sm text-text-secondary">
          {hasFilters
            ? 'Try adjusting your search or filters.'
            : 'Add your first transaction using the + button below.'}
        </p>
      </div>
      {hasFilters && (
        <button
          onClick={onClear}
          className="px-5 py-2.5 rounded-2xl font-body text-sm font-semibold text-white transition-opacity"
          style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
        >
          Clear filters
        </button>
      )}
    </motion.div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function TransactionList({
  transactions,
  categoryIcons,
  visibleCount,
  hasMore,
  onLoadMore,
  onTap,
  onDeleteRequest,
  hasFilters,
  onClearFilters,
}) {
  const sentinelRef = useRef(null);

  // Client-side virtual page — only render first `visibleCount` items
  const visible = useMemo(() => transactions.slice(0, visibleCount), [transactions, visibleCount]);
  const groups  = useMemo(() => groupByDate(visible), [visible]);

  // IntersectionObserver → fires onLoadMore when sentinel scrolls into view
  const onObserve = useCallback(
    (entries) => { if (entries[0].isIntersecting) onLoadMore(); },
    [onLoadMore],
  );

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const io = new IntersectionObserver(onObserve, { threshold: 0.1 });
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [hasMore, onObserve]);

  if (transactions.length === 0) {
    return <EmptyState hasFilters={hasFilters} onClear={onClearFilters} />;
  }

  return (
    <div className="space-y-3 pb-4">
      <AnimatePresence initial={false}>
        {groups.map((group, gi) => (
          <motion.div
            key={group.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: gi * 0.03 }}
          >
            {/* Sticky date header */}
            <div
              className="sticky z-10 py-1.5 mb-1.5"
              style={{
                top: '56px',           // clears the page's own sticky header
                backgroundColor: '#0F0F1A',
              }}
            >
              <div className="flex items-center gap-3">
                <span className="font-heading text-[11px] font-bold text-text-secondary uppercase tracking-widest whitespace-nowrap">
                  {group.label}
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
                <span className="font-body text-[10px] text-text-secondary">
                  {group.items.length} {group.items.length === 1 ? 'txn' : 'txns'}
                </span>
              </div>
            </div>

            {/* Rows */}
            <div className="space-y-0.5">
              {group.items.map((txn) => (
                <TransactionItem
                  key={txn.id}
                  txn={txn}
                  categoryIcon={categoryIcons[txn.category]}
                  onTap={onTap}
                  onDeleteRequest={onDeleteRequest}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Infinite-scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-6 gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="font-body text-xs text-text-secondary">Loading more…</span>
        </div>
      )}

      {/* End-of-list message */}
      {!hasMore && transactions.length > 0 && (
        <p className="text-center font-body text-xs text-text-secondary py-6 opacity-50">
          ✓ You've seen all {transactions.length} transactions
        </p>
      )}
    </div>
  );
}
