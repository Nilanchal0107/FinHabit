/**
 * MonthlyHeatmap.jsx
 * 7-column calendar grid (Sun–Sat) with spending heat color coding.
 * Each cell → colour by spend level, small amount label, today border,
 * and a ↻ badge when a recurring payment is predicted.
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── helpers ───────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Format small currency label inside a cell */
function fmtSmall(n) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)   return `₹${(n / 1_000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

/** Given day's total spend vs daily average, return background & text color */
function cellColors(spend, avg) {
  if (spend === 0) return { bg: 'transparent', text: 'transparent', ring: false };
  if (avg === 0 || spend <= avg)        return { bg: 'rgba(34,197,94,0.15)',  text: '#22C55E' };
  if (spend <= avg * 2)                 return { bg: 'rgba(245,158,11,0.18)', text: '#F59E0B' };
  return { bg: 'rgba(244,63,94,0.20)',  text: '#F43F5E' };
}

/** Return YYYY-MM-DD string in IST for a JS Date */
function toISTDateStr(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// ── skeleton cell ─────────────────────────────────────────────────────────────

function SkeletonCell() {
  return (
    <div className="aspect-square rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
  );
}

// ── MonthlyHeatmap ────────────────────────────────────────────────────────────

export default function MonthlyHeatmap({
  year,
  month,          // 0-indexed
  transactions,
  recurringFlags, // Map<dateStr YYYY-MM-DD, { merchant, amount }[]>
  onDaySelect,
  selectedDay,    // YYYY-MM-DD string or null
  isLoading,
}) {
  const todayStr = toISTDateStr(new Date());

  // ── Compute per-day totals ─────────────────────────────────────────────────
  const { daySpend, dailyAvg, calendarDays } = useMemo(() => {
    // Build map of YYYY-MM-DD → total debit spend for that IST day
    const spendMap = {};
    for (const t of transactions) {
      if (!t.date) continue;
      const key = toISTDateStr(new Date(t.date));
      const amt = t.transactionType === 'debit' ? (t.amount || 0) : 0;
      spendMap[key] = (spendMap[key] || 0) + amt;
    }

    // Calendar grid: find first day-of-week of month and total days
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun..6=Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Build flat list of cells (nulls for leading blanks + day objects)
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = toISTDateStr(date);
      cells.push({ day: d, dateStr, spend: spendMap[dateStr] || 0 });
    }

    // Daily average = total spend / days with any spend
    const allSpend = Object.values(spendMap).filter(Boolean);
    const avg = allSpend.length > 0 ? allSpend.reduce((a, b) => a + b, 0) / allSpend.length : 0;

    return { daySpend: spendMap, dailyAvg: avg, calendarDays: cells };
  }, [transactions, year, month]);

  // ── Month label ───────────────────────────────────────────────────────────
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric',
  });

  return (
    <div className="select-none">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1.5">
        {DAYS.map((d) => (
          <div key={d} className="text-center font-body text-[10px] text-text-secondary py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        <AnimatePresence mode="wait">
          {isLoading
            ? Array.from({ length: 35 }).map((_, i) => <SkeletonCell key={i} />)
            : calendarDays.map((cell, i) => {
                if (!cell) {
                  // Leading blank
                  return <div key={`blank-${i}`} className="aspect-square" />;
                }

                const { day, dateStr, spend } = cell;
                const isToday    = dateStr === todayStr;
                const isSelected = dateStr === selectedDay;
                const hasRecurring = recurringFlags?.has(dateStr);
                const { bg, text } = cellColors(spend, dailyAvg);
                const isEmpty = spend === 0;

                return (
                  <motion.button
                    key={dateStr}
                    onClick={() => onDaySelect(isSelected ? null : dateStr)}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.93 }}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.008, type: 'spring', stiffness: 400, damping: 28 }}
                    className="relative aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all"
                    style={{
                      backgroundColor: isSelected
                        ? 'rgba(79,70,229,0.25)'
                        : bg,
                      border: isToday
                        ? '2px solid #7C3AED'
                        : isSelected
                        ? '2px solid #4F46E5'
                        : '2px solid transparent',
                    }}
                    id={`cal-day-${dateStr}`}
                  >
                    {/* Day number */}
                    <span
                      className="font-body text-[11px] font-bold leading-none"
                      style={{ color: isToday ? '#A78BFA' : isEmpty ? '#8B8A9E' : '#F0EFF8' }}
                    >
                      {day}
                    </span>

                    {/* Spend label */}
                    {!isEmpty && (
                      <span
                        className="font-mono text-[8px] leading-none font-semibold"
                        style={{ color: text }}
                      >
                        {fmtSmall(spend)}
                      </span>
                    )}

                    {/* Recurring badge */}
                    {hasRecurring && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold z-10"
                        style={{ backgroundColor: '#7C3AED', color: '#fff', lineHeight: 1 }}
                        title="Predicted recurring payment"
                      >
                        ↻
                      </motion.span>
                    )}
                  </motion.button>
                );
              })
          }
        </AnimatePresence>
      </div>

      {/* Legend */}
      {!isLoading && (
        <div className="flex items-center justify-end gap-3 mt-3">
          {[
            { color: 'rgba(34,197,94,0.3)',  label: 'Normal' },
            { color: 'rgba(245,158,11,0.3)', label: '>avg' },
            { color: 'rgba(244,63,94,0.3)',  label: '>2×avg' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="font-body text-[9px] text-text-secondary">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
