import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { onSnapshot, doc } from 'firebase/firestore';
import { useEffect } from 'react';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { useTransactions } from '@hooks/useTransactions.js';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function BalanceCardSkeleton() {
  return (
    <div className="rounded-2xl p-5 animate-pulse" style={{ background: '#16162A' }}>
      <div className="h-4 w-32 rounded bg-white/10 mb-3" />
      <div className="h-10 w-48 rounded bg-white/10 mb-4" />
      <div className="h-3 w-24 rounded bg-white/10" />
    </div>
  );
}

// ── BalanceCard ───────────────────────────────────────────────────────────────

export default function BalanceCard() {
  const { user } = useAuthStore();
  const uid = user?.uid;

  const [expanded, setExpanded] = useState(false);
  const [income, setIncome] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);

  // Profile listener (income) — not encrypted in client path
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      doc(db, 'users', uid, 'profile', 'data'),
      (snap) => {
        if (snap.exists()) {
          const raw = snap.data()?.monthlyIncome;
          const parsed = parseFloat(raw);
          setIncome(isNaN(parsed) ? 0 : parsed);
        }
        setProfileLoading(false);
      },
      () => setProfileLoading(false)
    );
    return () => unsub();
  }, [uid]);

  // Get decrypted transactions from shared hook
  const { transactions, isLoading: txnLoading } = useTransactions('month');

  const loading = profileLoading || txnLoading;
  if (loading) return <BalanceCardSkeleton />;

  // Split transactions into debits and credits this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const inRange = (t) => {
    const d = t.date ? new Date(t.date) : null;
    return d && d >= monthStart && d <= monthEnd;
  };

  const monthDebits  = transactions.filter((t) => t.transactionType === 'debit'  && inRange(t));
  const monthCredits = transactions.filter((t) => t.transactionType === 'credit' && inRange(t));

  const totalDebit  = monthDebits.reduce((s, t)  => s + (t.amount || 0), 0);
  const totalCredit = monthCredits.reduce((s, t) => s + (t.amount || 0), 0);

  // Balance = income (salary set in profile) + any extra credits - debits
  const remaining    = Math.max(0, income + totalCredit - totalDebit);
  const spendBasis   = income + totalCredit;  // denominator for the progress bar
  const remainingPct = spendBasis > 0 ? Math.round((remaining / spendBasis) * 100) : 100;

  const color =
    remainingPct > 50
      ? { main: '#22C55E', bg: 'rgba(34,197,94,0.08)' }
      : remainingPct > 20
      ? { main: '#F59E0B', bg: 'rgba(245,158,11,0.08)' }
      : { main: '#F43F5E', bg: 'rgba(244,63,94,0.08)' };

  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <motion.div
      layout
      onClick={() => setExpanded((e) => !e)}
      className="rounded-2xl p-5 cursor-pointer select-none"
      style={{ background: '#16162A', border: `1px solid ${color.main}33` }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-body font-medium text-text-secondary uppercase tracking-widest">
          Balance · {monthLabel}
        </span>
        <motion.span animate={{ rotate: expanded ? 180 : 0 }} className="text-text-secondary text-sm">
          ▾
        </motion.span>
      </div>

      {/* Main amount */}
      <div
        className="font-mono text-4xl font-bold leading-tight mt-1"
        style={{ color: color.main }}
        id="balance-card-amount"
      >
        {fmt(remaining)}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: `${remainingPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ background: color.main }}
        />
      </div>

      {/* Expandable rows */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-xl p-4 space-y-3" style={{ background: color.bg }}>
              {[
                { label: 'Profile Income',   value: income,       color: '#22C55E' },
                ...(totalCredit > 0 ? [{ label: 'Credits Received', value: totalCredit, color: '#22C55E' }] : []),
                { label: 'Total Spent',      value: totalDebit,   color: '#F43F5E' },
                { label: 'Remaining',        value: remaining,    color: color.main },
              ].map(({ label, value, color: c }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm font-body text-text-secondary">{label}</span>
                  <span className="font-mono text-sm font-semibold" style={{ color: c }}>
                    {fmt(value)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
