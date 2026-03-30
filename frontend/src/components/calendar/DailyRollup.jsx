/**
 * DailyRollup.jsx
 * Accordion that slides in below the calendar when a day is tapped.
 * Shows full transaction list for that day + "Add expense" button.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useUIStore } from '@store/uiStore.js';
import { DEFAULT_CATEGORIES } from '@utils/categories.js';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(Math.abs(n));

function fmtTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function fmtDayHeader(dateStr) {
  // e.g. "21 March 2026"
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
}

// ── Mini transaction row (lighter than full TransactionItem — no swipe) ───────

function MiniTxnRow({ txn, categoryIcons }) {
  const isDebit = txn.transactionType === 'debit';
  const cat = DEFAULT_CATEGORIES.find((c) => c.name.toLowerCase() === (txn.category || '').toLowerCase());
  const icon = categoryIcons?.[txn.category] || cat?.icon || '💳';

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/4 transition-colors">
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
        style={{ backgroundColor: cat ? `${cat.color}18` : 'rgba(79,70,229,0.12)' }}
      >
        {icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm font-medium text-text-primary truncate">{txn.merchant}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {txn.category && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-md font-body text-[9px] font-medium"
              style={{ backgroundColor: cat ? `${cat.color}18` : 'rgba(79,70,229,0.12)', color: cat?.color || '#A5B4FC' }}
            >
              {txn.category}
            </span>
          )}
          <span className="font-body text-[10px] text-text-secondary">{fmtTime(txn.date)}</span>
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
          <p className="font-body text-[10px] text-text-secondary">{txn.paymentMethod}</p>
        )}
      </div>
    </div>
  );
}

// ── DailyRollup ───────────────────────────────────────────────────────────────

export default function DailyRollup({ dateStr, transactions, categoryIcons }) {
  const { openModal } = useUIStore();

  // Filter + sort transactions for this day
  const dayTxns = useMemo(() => {
    if (!dateStr) return [];
    return [...transactions]
      .filter((t) => {
        if (!t.date) return false;
        const d = toISTDateStr(new Date(t.date));
        return d === dateStr;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [dateStr, transactions]);

  const totalDebit  = dayTxns.filter((t) => t.transactionType === 'debit').reduce((s, t) => s + t.amount, 0);
  const totalCredit = dayTxns.filter((t) => t.transactionType !== 'debit').reduce((s, t) => s + t.amount, 0);

  const handleAddForDay = () => {
    // Open manual tab pre-filled with this day's date
    openModal('manual', { date: dateStr });
  };

  if (!dateStr) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0, y: -8 }}
      animate={{ opacity: 1, height: 'auto', y: 0 }}
      exit={{ opacity: 0, height: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="overflow-hidden rounded-2xl mt-3"
      style={{ backgroundColor: '#16162A' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div>
          <h3 className="font-heading text-sm font-bold text-text-primary">
            {fmtDayHeader(dateStr)}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            {totalDebit > 0 && (
              <span className="font-body text-xs" style={{ color: '#F43F5E' }}>
                −{fmt(totalDebit)}
              </span>
            )}
            {totalCredit > 0 && (
              <span className="font-body text-xs" style={{ color: '#22C55E' }}>
                +{fmt(totalCredit)}
              </span>
            )}
          </div>
        </div>

        {/* Add expense button */}
        <button
          onClick={handleAddForDay}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-body text-xs font-semibold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
          id={`add-expense-${dateStr}`}
        >
          + Add
        </button>
      </div>

      {/* ── Transaction rows ────────────────────────────────────────────── */}
      <div className="px-1 pb-3">
        {dayTxns.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <span className="text-3xl">💸</span>
            <p className="font-body text-sm text-text-secondary">No transactions on this day</p>
            <button
              onClick={handleAddForDay}
              className="mt-1 px-4 py-2 rounded-2xl font-body text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
            >
              + Add expense for this day
            </button>
          </div>
        ) : (
          dayTxns.map((txn) => (
            <MiniTxnRow key={txn.id} txn={txn} categoryIcons={categoryIcons} />
          ))
        )}
      </div>
    </motion.div>
  );
}

// ── local helper (duplicated to avoid cross-file import complexity) ──────────
function toISTDateStr(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
