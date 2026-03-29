import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { useTransactions } from '@hooks/useTransactions.js';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.abs(n));

function daysElapsed() { return Math.max(1, new Date().getDate()); }
function daysInMonth()  { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate(); }
function daysLeft()     { return Math.max(1, daysInMonth() - new Date().getDate()); }

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function QuickStatsRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl p-4" style={{ background: '#16162A' }}>
          <div className="h-3 w-20 rounded bg-white/10 mb-2" />
          <div className="h-6 w-28 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

// ── Tile ──────────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, color, icon, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl p-4"
      style={{ background: '#16162A' }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-body text-text-secondary">{label}</span>
      </div>
      <span className="font-mono text-lg font-bold" style={{ color }}>{value}</span>
      {sub && <p className="text-[10px] font-body text-text-secondary mt-0.5">{sub}</p>}
    </motion.div>
  );
}

// ── QuickStatsRow ─────────────────────────────────────────────────────────────

export default function QuickStatsRow() {
  const { user } = useAuthStore();
  const uid = user?.uid;
  const [budgetTotal, setBudgetTotal] = useState(0);

  // Budgets
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(collection(db, 'users', uid, 'budgets'), (snap) => {
      const total = snap.docs.reduce((s, d) => s + (parseFloat(d.data().limit) || 0), 0);
      setBudgetTotal(total);
    }, () => {});
    return () => unsub();
  }, [uid]);

  // Decrypted transactions (current month)
  const { transactions, isLoading } = useTransactions('month');

  if (isLoading) return <QuickStatsRowSkeleton />;

  const debits    = transactions.filter((t) => t.transactionType === 'debit');
  const totalSpent = debits.reduce((s, t) => s + (t.amount || 0), 0);
  const dailyAvg  = totalSpent / daysElapsed();
  const biggestDebit = debits.reduce((max, t) => Math.max(max, t.amount || 0), 0);

  const remaining   = Math.max(0, budgetTotal - totalSpent);
  const safeToday   = remaining / daysLeft();

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile
        icon="📊" label="Daily Average"
        value={fmt(dailyAvg)}
        sub={`over ${daysElapsed()} days this month`}
        color="#F0EFF8" delay={0}
      />
      <StatTile
        icon="🏆" label="Biggest Expense"
        value={biggestDebit > 0 ? fmt(biggestDebit) : '—'}
        sub="this month"
        color="#F43F5E" delay={0.05}
      />
      <StatTile
        icon="📈" label="Total Spent"
        value={fmt(totalSpent)}
        sub={`${debits.length} transaction${debits.length !== 1 ? 's' : ''}`}
        color="#F59E0B" delay={0.1}
      />
      <StatTile
        icon="🛡️" label="Safe Today"
        value={safeToday > 0 ? fmt(safeToday) : '—'}
        sub={`budget ÷ ${daysLeft()} days left`}
        color="#22C55E" delay={0.15}
      />
    </div>
  );
}
