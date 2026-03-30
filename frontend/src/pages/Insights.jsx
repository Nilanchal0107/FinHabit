/**
 * Insights.jsx — Prompt 8
 *
 * Layout (vertically stacked):
 *   ① Period toggle (Weekly / Monthly)
 *   ② WeeklySummary  — Groq-generated insight card + history
 *   ③ SmartRecommendations — tip cards + Firestore persistence
 *   ④ TrendChart — Recharts 30/90 day category lines
 *   ⑤ SpendingHeatmap — 24×7 hour/weekday grid
 *   ⑥ MerchantLoyalty — top-5 merchants by spend
 *
 * Data:
 *   - useAllTransactions() → all decrypted txns for TrendChart / Heatmap / Merchants
 *   - WeeklySummary uses its own Firestore listener internally
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { useAllTransactions } from '@hooks/useAllTransactions.js';

import WeeklySummary         from '@components/insights/WeeklySummary.jsx';
import SmartRecommendations  from '@components/insights/SmartRecommendations.jsx';
import TrendChart            from '@components/insights/TrendChart.jsx';
import SpendingHeatmap       from '@components/insights/SpendingHeatmap.jsx';
import MerchantLoyalty       from '@components/insights/MerchantLoyalty.jsx';

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="px-4 md:px-6 space-y-5 pt-4 animate-pulse">
      <div className="h-10 w-48 rounded-2xl bg-white/8 mx-auto" />
      <div className="h-48 rounded-3xl bg-white/8" />
      <div className="h-32 rounded-3xl bg-white/8" />
      <div className="h-56 rounded-3xl bg-white/8" />
    </div>
  );
}

// ── Total spend summary strip ─────────────────────────────────────────────────

function SummaryStrip({ transactions, period }) {
  const stats = useMemo(() => {
    const cutoff = new Date(
      Date.now() - (period === 'weekly' ? 7 : 30) * 86_400_000
    );
    const filtered = transactions.filter(
      (t) => t.date && new Date(t.date) >= cutoff
    );
    let spent = 0, income = 0;
    for (const t of filtered) {
      if (t.transactionType === 'debit') spent += t.amount;
      else income += t.amount;
    }
    return { spent, income, count: filtered.length };
  }, [transactions, period]);

  const fmt = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1,
    }).format(n);

  const items = [
    { label: 'Spent',        value: fmt(stats.spent),  color: '#F43F5E', icon: '📤' },
    { label: 'Received',     value: fmt(stats.income), color: '#22C55E', icon: '📥' },
    { label: 'Transactions', value: String(stats.count), color: '#A78BFA', icon: '🧾' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-3 gap-3"
    >
      {items.map(({ label, value, color, icon }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-1 py-3 rounded-2xl"
          style={{ backgroundColor: '#16162A' }}
        >
          <span className="text-base">{icon}</span>
          <p className="font-mono text-sm font-bold" style={{ color }}>{value}</p>
          <p className="font-body text-[9px] text-text-secondary">{label}</p>
        </div>
      ))}
    </motion.div>
  );
}

// ── Insights page ─────────────────────────────────────────────────────────────

export default function Insights() {
  const { user }          = useAuthStore();
  const uid               = user?.uid;
  const [period, setPeriod] = useState('weekly');

  // All transactions for client-side charts
  const { transactions, isLoading } = useAllTransactions();

  // Latest insight from Firestore (for SmartRecommendations + SpendingHeatmap)
  const [latestInsight, setLatestInsight] = useState(null);
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'insights'),
      orderBy('generatedAt', 'desc'),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) setLatestInsight({ id: snap.docs[0].id, ...snap.docs[0].data() });
    }, () => {});
    return () => unsub();
  }, [uid]);

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="min-h-screen" style={{ paddingBottom: '6rem' }}>

      {/* ── Mobile sticky header ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 px-4 pt-4 pb-3 md:hidden"
        style={{
          background: 'rgba(15,15,26,0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <h1 className="font-heading text-base font-bold text-text-primary mb-3">AI Insights</h1>

        {/* Period toggle */}
        <div
          className="flex items-center gap-1 p-1 rounded-2xl w-fit mx-auto"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
          {['weekly', 'monthly'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-4 py-1.5 rounded-xl font-body text-xs font-semibold capitalize transition-all"
              style={{
                backgroundColor: period === p ? '#4F46E5' : 'transparent',
                color:           period === p ? '#fff'    : '#8B8A9E',
              }}
              id={`insights-period-${p}`}
            >
              {p}
            </button>
          ))}
        </div>
      </header>

      {/* ── Desktop heading ──────────────────────────────────────────────── */}
      <div className="hidden md:flex items-center justify-between px-6 pt-6 pb-2">
        <h1 className="font-heading text-2xl font-bold text-text-primary">AI Insights</h1>
        <div
          className="flex items-center gap-1 p-1 rounded-2xl"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
          {['weekly', 'monthly'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-5 py-2 rounded-xl font-body text-sm font-semibold capitalize transition-all"
              style={{
                backgroundColor: period === p ? '#4F46E5' : 'transparent',
                color:           period === p ? '#fff'    : '#8B8A9E',
              }}
              id={`insights-period-${p}-desktop`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-6 space-y-6 pt-4">

        {/* ── Stats strip ───────────────────────────────────────────────── */}
        <SummaryStrip transactions={transactions} period={period} />

        {/* ── Weekly / Monthly AI Summary ───────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={period}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <WeeklySummary period={period} />
          </motion.div>
        </AnimatePresence>

        {/* ── Smart Recommendations ─────────────────────────────────────── */}
        <SmartRecommendations insight={latestInsight} />

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="h-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

        {/* ── Trend chart ───────────────────────────────────────────────── */}
        <TrendChart transactions={transactions} />

        {/* ── Spending heatmap ──────────────────────────────────────────── */}
        <SpendingHeatmap transactions={transactions} insight={latestInsight} />

        {/* ── Merchant loyalty ──────────────────────────────────────────── */}
        <MerchantLoyalty transactions={transactions} />

      </div>
    </div>
  );
}
