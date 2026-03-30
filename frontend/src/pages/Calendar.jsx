/**
 * Calendar.jsx — Prompt 7
 *
 * Layout:
 *   ┌──────────────────────────────┐
 *   │ Month navigation header      │
 *   │ Monthly heatmap grid         │
 *   │ [DailyRollup accordion]      │  ← shown when a day is tapped
 *   │ Monthly summary strip        │
 *   └──────────────────────────────┘
 *   RecurringSheet (full-screen bottom sheet overlay)
 *
 * Data strategy:
 *   - useCalendarTransactions(year, month) for current view month
 *   - useAllTransactions() for the full history used by recurring detection
 *   - Adjacent months are pre-fetched in the background by the hook
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { useCalendarTransactions } from '@hooks/useCalendarTransactions.js';
import { useAllTransactions } from '@hooks/useAllTransactions.js';
import { detectRecurring } from '@utils/recurringEngine.js';

import MonthlyHeatmap from '@components/calendar/MonthlyHeatmap.jsx';
import DailyRollup    from '@components/calendar/DailyRollup.jsx';
import RecurringSheet from '@components/calendar/RecurringSheet.jsx';

// ── helpers ───────────────────────────────────────────────────────────────────

function toISTDateStr(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function nowIST() {
  const d = new Date();
  return new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n);

// ── Month summary strip ───────────────────────────────────────────────────────

function MonthlySummary({ transactions, isLoading }) {
  const { totalDebit, totalCredit, txnCount, topCategory } = useMemo(() => {
    let d = 0, c = 0;
    const catSpend = {};
    for (const t of transactions) {
      if (t.transactionType === 'debit') {
        d += t.amount;
        catSpend[t.category] = (catSpend[t.category] || 0) + t.amount;
      } else {
        c += t.amount;
      }
    }
    const top = Object.entries(catSpend).sort((a, b) => b[1] - a[1])[0];
    return {
      totalDebit:  d,
      totalCredit: c,
      txnCount:    transactions.length,
      topCategory: top ? top[0] : null,
    };
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3 mt-4 animate-pulse">
        {[1,2,3].map((i) => (
          <div key={i} className="rounded-2xl p-4 h-20" style={{ backgroundColor: '#16162A' }} />
        ))}
      </div>
    );
  }

  const stats = [
    { label: 'Total Spent',    value: fmt(totalDebit),  color: '#F43F5E', icon: '📤' },
    { label: 'Total Income',   value: fmt(totalCredit), color: '#22C55E', icon: '📥' },
    { label: 'Transactions',   value: String(txnCount),  color: '#A78BFA', icon: '🧾' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-3 gap-3 mt-4"
    >
      {stats.map(({ label, value, color, icon }) => (
        <div
          key={label}
          className="rounded-2xl p-3 flex flex-col gap-1.5"
          style={{ backgroundColor: '#16162A' }}
        >
          <span className="text-lg">{icon}</span>
          <p className="font-mono text-sm font-bold truncate" style={{ color }}>{value}</p>
          <p className="font-body text-[10px] text-text-secondary">{label}</p>
        </div>
      ))}
    </motion.div>
  );
}

// ── Month navigation header ────────────────────────────────────────────────────

function MonthNav({ year, month, onPrev, onNext, onToday }) {
  const label = new Date(year, month, 1).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric',
  });
  const now   = nowIST();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    <div className="flex items-center justify-between">
      <motion.button
        onClick={onPrev}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
        style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        id="cal-prev-month"
      >
        ‹
      </motion.button>

      <div className="flex flex-col items-center gap-1">
        <h2 className="font-heading text-lg font-bold text-text-primary">{label}</h2>
        {!isCurrentMonth && (
          <button
            onClick={onToday}
            className="font-body text-[10px] font-semibold px-2.5 py-0.5 rounded-full transition-colors"
            style={{ backgroundColor: 'rgba(79,70,229,0.15)', color: '#A5B4FC' }}
            id="cal-today-btn"
          >
            Today
          </button>
        )}
      </div>

      <motion.button
        onClick={onNext}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
        style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        id="cal-next-month"
      >
        ›
      </motion.button>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyMonth({ label }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-14 gap-3 text-center"
    >
      <span className="text-5xl">📅</span>
      <p className="font-heading text-base font-bold text-text-primary">No transactions in {label}</p>
      <p className="font-body text-sm text-text-secondary max-w-xs">
        Add your first transaction for this month using the + button.
      </p>
    </motion.div>
  );
}

// ── Calendar page ─────────────────────────────────────────────────────────────

export default function Calendar() {
  const { user }  = useAuthStore();
  const uid       = user?.uid;

  // Current view month
  const startIST = nowIST();
  const [viewYear,  setViewYear]  = useState(startIST.getFullYear());
  const [viewMonth, setViewMonth] = useState(startIST.getMonth());

  // Selected day (YYYY-MM-DD in IST)
  const [selectedDay, setSelectedDay] = useState(null);

  // Recurring sheet
  const [recurringDate,        setRecurringDate]        = useState(null);
  const [recurringPredictions, setRecurringPredictions] = useState([]);

  // Category icons from Firestore
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

  // Fetch current-month transactions
  const { transactions: monthTxns, isLoading } = useCalendarTransactions(viewYear, viewMonth);

  // Fetch ALL transactions for recurring detection
  const { transactions: allTxns } = useAllTransactions();

  // Recurring detection (memoised — re-runs only when allTxns or view month changes)
  const recurringFlags = useMemo(
    () => detectRecurring(allTxns, viewYear, viewMonth),
    [allTxns, viewYear, viewMonth]
  );

  // ── Month navigation ───────────────────────────────────────────────────────
  const goToPrev = useCallback(() => {
    setSelectedDay(null);
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const goToNext = useCallback(() => {
    setSelectedDay(null);
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const goToToday = useCallback(() => {
    const n = nowIST();
    setViewYear(n.getFullYear());
    setViewMonth(n.getMonth());
    setSelectedDay(toISTDateStr(new Date()));
  }, []);

  // ── Day tap ────────────────────────────────────────────────────────────────
  const handleDaySelect = useCallback((dateStr) => {
    setSelectedDay(dateStr);
    // If there are recurring predictions on this day, don't auto-open sheet
    // — user must tap the ↻ badge specifically (handled by badge click below)
  }, []);

  // ── Recurring badge tap (called from heatmap via day cell) ─────────────────
  // We detect tap on recurring cell: if user taps a day that has recurring predictions,
  // show the RecurringSheet. We wire this via day selection + flag presence.
  useEffect(() => {
    if (!selectedDay) return;
    const preds = recurringFlags.get(selectedDay);
    if (preds?.length) {
      // Auto-show recurring sheet when tapping a day with predictions
      // and no real transactions (user is likely checking if they paid)
      const hasRealTxns = monthTxns.some((t) => {
        if (!t.date) return false;
        return toISTDateStr(new Date(t.date)) === selectedDay;
      });
      if (!hasRealTxns) {
        setRecurringDate(selectedDay);
        setRecurringPredictions(preds);
      }
    }
  }, [selectedDay, recurringFlags, monthTxns]);

  const handleRecurringDismiss = useCallback(() => {
    setRecurringDate(null);
    setRecurringPredictions([]);
  }, []);

  const handleRecurringConfirm = useCallback(() => {
    setRecurringDate(null);
    setRecurringPredictions([]);
  }, []);

  // ── Month label ────────────────────────────────────────────────────────────
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric',
  });

  const isEmpty = !isLoading && monthTxns.length === 0;

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: '6rem' }}>

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
        <h1 className="font-heading text-base font-bold text-text-primary mb-3">Calendar</h1>
        <MonthNav
          year={viewYear} month={viewMonth}
          onPrev={goToPrev} onNext={goToNext} onToday={goToToday}
        />
      </header>

      {/* ── Desktop heading ──────────────────────────────────────────────── */}
      <div className="hidden md:flex items-center justify-between px-6 pt-6 pb-4">
        <h1 className="font-heading text-2xl font-bold text-text-primary">Calendar</h1>
        <MonthNav
          year={viewYear} month={viewMonth}
          onPrev={goToPrev} onNext={goToNext} onToday={goToToday}
        />
      </div>

      <div className="px-4 md:px-6">

        {/* ── Calendar card ─────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${viewYear}-${viewMonth}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="rounded-2xl p-4"
            style={{ backgroundColor: '#16162A' }}
          >
            <MonthlyHeatmap
              year={viewYear}
              month={viewMonth}
              transactions={monthTxns}
              recurringFlags={recurringFlags}
              onDaySelect={handleDaySelect}
              selectedDay={selectedDay}
              isLoading={isLoading}
            />
          </motion.div>
        </AnimatePresence>

        {/* ── Daily rollup accordion ────────────────────────────────────── */}
        <AnimatePresence>
          {selectedDay && !isLoading && (
            <DailyRollup
              key={selectedDay}
              dateStr={selectedDay}
              transactions={monthTxns}
              categoryIcons={categoryIcons}
            />
          )}
        </AnimatePresence>

        {/* ── Empty state ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {isEmpty && !selectedDay && (
            <EmptyMonth key="empty" label={monthLabel} />
          )}
        </AnimatePresence>

        {/* ── Monthly summary ───────────────────────────────────────────── */}
        {!isEmpty && (
          <MonthlySummary transactions={monthTxns} isLoading={isLoading} />
        )}

        {/* ── Recurring legend note ─────────────────────────────────────── */}
        {recurringFlags.size > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 mt-4 px-3 py-2 rounded-xl"
            style={{ backgroundColor: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: '#7C3AED', color: '#fff' }}
            >
              ↻
            </span>
            <p className="font-body text-xs text-text-secondary">
              <span className="text-violet font-medium">{recurringFlags.size} predicted</span> recurring payments this month
            </p>
          </motion.div>
        )}
      </div>

      {/* ── Recurring predictions bottom sheet ────────────────────────────── */}
      <RecurringSheet
        dateStr={recurringDate}
        predictions={recurringPredictions}
        onDismiss={handleRecurringDismiss}
        onConfirm={handleRecurringConfirm}
      />
    </div>
  );
}
