import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@store/uiStore.js';
import { useAuthStore } from '@store/authStore.js';

import BalanceCard, { BalanceCardSkeleton } from '@components/dashboard/BalanceCard.jsx';
import SpendingPieChart, { SpendingPieChartSkeleton } from '@components/dashboard/SpendingPieChart.jsx';
import AIInsightCard, { AIInsightCardSkeleton } from '@components/dashboard/AIInsightCard.jsx';
import BudgetBurnRateCards, { BudgetBurnRateCardsSkeleton } from '@components/dashboard/BudgetBurnRateCards.jsx';
import RecentTransactions, { RecentTransactionsSkeleton } from '@components/dashboard/RecentTransactions.jsx';
import QuickStatsRow, { QuickStatsRowSkeleton } from '@components/dashboard/QuickStatsRow.jsx';
import MonthEndForecast, { MonthEndForecastSkeleton } from '@components/dashboard/MonthEndForecast.jsx';

// ── Empty state (new users) ───────────────────────────────────────────────────

function EmptyDashboard({ onAdd }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-6 py-20 px-6 text-center"
    >
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
        style={{ background: 'rgba(79,70,229,0.12)' }}
      >
        💸
      </div>
      <div>
        <h2 className="font-heading text-xl font-bold text-text-primary mb-2">
          Welcome to FinHabits!
        </h2>
        <p className="font-body text-sm text-text-secondary max-w-xs leading-relaxed">
          Your financial dashboard is ready. Add your first transaction to start
          tracking spending patterns and get AI-powered insights.
        </p>
      </div>
      <motion.button
        onClick={onAdd}
        className="px-6 py-3 rounded-2xl font-body font-semibold text-white text-sm"
        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        id="empty-state-add-transaction"
      >
        + Add First Transaction
      </motion.button>
    </motion.div>
  );
}

// ── Pull-to-refresh hook ──────────────────────────────────────────────────────

function usePullToRefresh(onRefresh) {
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  let startY = null;

  const onTouchStart = useCallback((e) => {
    startY = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback(
    (e) => {
      if (!startY) return;
      const delta = e.touches[0].clientY - startY;
      if (delta > 0 && window.scrollY === 0) {
        setPullY(Math.min(delta * 0.4, 60));
      }
    },
    []
  );

  const onTouchEnd = useCallback(async () => {
    if (pullY > 50 && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullY(0);
    startY = null;
  }, [pullY, refreshing, onRefresh]);

  return { pullY, refreshing, onTouchStart, onTouchMove, onTouchEnd };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuthStore();
  const { openModal } = useUIStore();

  const [key, setKey] = useState(0); // bump to force remount (pull-to-refresh)

  const handleRefresh = useCallback(() => {
    setKey((k) => k + 1);
    return Promise.resolve();
  }, []);

  const { pullY, refreshing, onTouchStart, onTouchMove, onTouchEnd } =
    usePullToRefresh(handleRefresh);

  const now = new Date();
  const headerDate = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div
      key={key}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative min-h-screen"
      style={{ paddingBottom: '6rem' }}
    >
      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {pullY > 10 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 flex justify-center pt-3 z-20 pointer-events-none"
          >
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-body"
              style={{ background: 'rgba(79,70,229,0.2)', color: '#A5B4FC' }}
            >
              <motion.span
                animate={{ rotate: refreshing ? 360 : 0 }}
                transition={{ repeat: Infinity, duration: 0.6, ease: 'linear' }}
              >
                ↻
              </motion.span>
              {refreshing ? 'Refreshing…' : 'Release to refresh'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 md:hidden"
        style={{
          background: 'rgba(15,15,26,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div>
          <h1 className="font-heading text-base font-bold text-text-primary">
            Dashboard
          </h1>
          <p className="text-xs font-body text-text-secondary">{headerDate}</p>
        </div>
        <div className="flex items-center gap-2">
          {user?.photoURL && (
            <img
              src={user.photoURL}
              alt={user.displayName || 'You'}
              className="w-8 h-8 rounded-full ring-2 ring-primary/30"
            />
          )}
          <button
            onClick={() => {/* future: open notifications panel */ }}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)' }}
            aria-label="Notifications"
            id="dashboard-bell-btn"
          >
            🔔
          </button>
        </div>
      </header>

      {/* ── Desktop page heading ───────────────────────────────────────────── */}
      <div className="hidden md:flex items-center justify-between px-6 pt-6 pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">
            Dashboard
          </h1>
          <p className="text-sm font-body text-text-secondary">{headerDate}</p>
        </div>
        <button
          onClick={() => openModal('sms-input')}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-body font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
          id="dashboard-add-transaction-desktop"
        >
          + Add Transaction
        </button>
      </div>

      {/* ── Content grid ──────────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 space-y-4 md:space-y-5">
        {/* Balance + Quick Stats */}
        <div className="grid md:grid-cols-2 gap-4">
          <BalanceCard />
          <QuickStatsRow />
        </div>

        {/* Spending Pie + AI Insight */}
        <div className="grid md:grid-cols-2 gap-4">
          <SpendingPieChart />
          <div className="flex flex-col gap-4">
            <AIInsightCard />
            <MonthEndForecast />
          </div>
        </div>

        {/* Budget Burn Rate */}
        <BudgetBurnRateCards />

        {/* Recent Transactions */}
        <RecentTransactions />
      </div>
    </div>
  );
}
