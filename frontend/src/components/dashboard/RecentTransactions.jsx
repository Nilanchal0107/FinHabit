import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { useUIStore } from '@store/uiStore.js';
import { useTransactions } from '@hooks/useTransactions.js';
import { Link } from 'react-router-dom';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.abs(n));

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const opts = { timeZone: 'Asia/Kolkata' };
  const date = d.toLocaleDateString('en-IN', { ...opts, day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-IN', { ...opts, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date}, ${time}`;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function RecentTransactionsSkeleton() {
  return (
    <div className="rounded-2xl p-5 animate-pulse" style={{ background: '#16162A' }}>
      <div className="h-4 w-40 rounded bg-white/10 mb-4" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 rounded bg-white/10 w-3/5" />
              <div className="h-2.5 rounded bg-white/10 w-2/5" />
            </div>
            <div className="h-4 w-16 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function CategoryBadge({ category }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-body font-medium"
      style={{ background: 'rgba(79,70,229,0.12)', color: '#A5B4FC' }}
    >
      {category}
    </span>
  );
}

// ── RecentTransactions ────────────────────────────────────────────────────────

export default function RecentTransactions() {
  const { user } = useAuthStore();
  const uid = user?.uid;
  const { activeCategory } = useUIStore();
  const [categoryIcons, setCategoryIcons] = useState({});

  // Category icons (unencrypted — read directly)
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(collection(db, 'users', uid, 'categories'), (snap) => {
      const icons = {};
      snap.docs.forEach((d) => { const data = d.data(); icons[data.name] = data.icon || '💳'; });
      setCategoryIcons(icons);
    }, () => {});
    return () => unsub();
  }, [uid]);

  // Decrypted transactions (shared hook — limit=all to display full list)
  const { transactions, isLoading } = useTransactions('month');

  if (isLoading) return <RecentTransactionsSkeleton />;

  // Sort by date desc, apply category filter, take top 10
  const sorted  = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const filtered = activeCategory ? sorted.filter((t) => t.category === activeCategory) : sorted;
  const displayed = filtered.slice(0, 10);

  return (
    <div className="rounded-2xl p-5" style={{ background: '#16162A' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-sm font-bold text-text-primary uppercase tracking-widest">
          Recent Transactions
          {activeCategory && (
            <span className="ml-2 text-xs font-body font-normal text-primary normal-case">· {activeCategory}</span>
          )}
        </h3>
        <Link to="/transactions" className="text-xs font-body font-medium text-primary hover:text-violet transition-colors" id="view-all-transactions">
          View all →
        </Link>
      </div>

      {/* Empty state */}
      {displayed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <span className="text-4xl">{activeCategory ? '🔍' : '💸'}</span>
          <p className="text-sm font-body text-text-secondary text-center">
            {activeCategory
              ? `No transactions in "${activeCategory}" category`
              : 'No transactions yet. Add your first one via the + button!'}
          </p>
        </div>
      )}

      {/* List */}
      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {displayed.map((txn, i) => {
            const isDebit = txn.transactionType === 'debit';
            const icon = categoryIcons[txn.category] || '💳';
            return (
              <motion.div
                key={txn.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/4 transition-colors"
                id={`txn-row-${txn.id}`}
              >
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: 'rgba(79,70,229,0.12)' }}
                >
                  {icon}
                </div>

                {/* Merchant + badge */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium text-text-primary truncate">{txn.merchant}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {txn.category && <CategoryBadge category={txn.category} />}
                    <span className="text-[10px] font-body text-text-secondary">{formatTime(txn.date)}</span>
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  <span
                    className="font-mono text-sm font-semibold"
                    style={{ color: isDebit ? '#F43F5E' : '#22C55E' }}
                  >
                    {isDebit ? '−' : '+'}{fmt(txn.amount)}
                  </span>
                  {txn.paymentMethod && (
                    <p className="text-[10px] font-body text-text-secondary">{txn.paymentMethod}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
