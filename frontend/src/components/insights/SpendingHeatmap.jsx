/**
 * SpendingHeatmap.jsx
 * 24 columns (hours 0–23) × 7 rows (Mon–Sun) grid.
 * Cell color intensity = debit spend at that IST hour × day.
 * Includes a Groq-derived or client-computed one-line observation.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';

// ── helpers ───────────────────────────────────────────────────────────────────

const DAY_LABELS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// IST getDay(): 0=Sun,1=Mon..6=Sat. Remap to Mon=0..Sun=6
function istDayIndex(d) {
  const day = d.getDay(); // 0=Sun
  return day === 0 ? 6 : day - 1; // Mon=0..Sun=6
}

function toISTDate(dateStr) {
  return new Date(new Date(dateStr).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

// Convert a spend amount to a background colour with variable opacity
function heatColor(spend, maxSpend) {
  if (spend === 0 || maxSpend === 0) return 'rgba(255,255,255,0.03)';
  const intensity = Math.min(spend / maxSpend, 1); // 0..1
  // Purple gradient: low = faint violet, high = vivid violet
  const alpha = 0.08 + intensity * 0.82;
  return `rgba(124,58,237,${alpha.toFixed(2)})`;
}

function fmt(n) {
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

// ── Client-computed observation ───────────────────────────────────────────────

function computeObservation(heatMap, maxSpend) {
  if (maxSpend === 0) return null;

  // Find the (day, hour) cell with max spend
  let bestDay = 0, bestHour = 0, bestAmt = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const amt = heatMap[d]?.[h] || 0;
      if (amt > bestAmt) { bestAmt = amt; bestDay = d; bestHour = h; }
    }
  }

  // Find peak hour range (hours with >40% of max)
  const hourTotals = Array.from({ length: 24 }, (_, h) =>
    DAY_LABELS.reduce((s, _, d) => s + (heatMap[d]?.[h] || 0), 0)
  );
  const maxHourTotal = Math.max(...hourTotals);
  const peakHours = hourTotals
    .map((v, h) => ({ h, v }))
    .filter((x) => x.v >= maxHourTotal * 0.4)
    .map((x) => x.h);

  const fmtHour = (h) => {
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  };

  const hRange = peakHours.length >= 2
    ? `${fmtHour(peakHours[0])}–${fmtHour(peakHours[peakHours.length - 1])}`
    : fmtHour(bestHour);

  return `You spend most on ${DAY_LABELS[bestDay]}s around ${hRange} (avg ${fmt(bestAmt)}).`;
}

// ── SpendingHeatmap ───────────────────────────────────────────────────────────

export default function SpendingHeatmap({ transactions, insight }) {
  const { heatMap, maxSpend, observation } = useMemo(() => {
    // Build 7×24 grid [dayIndex][hour] = total spend
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));

    for (const t of transactions) {
      if (t.transactionType !== 'debit' || !t.date) continue;
      const d   = toISTDate(t.date);
      const day = istDayIndex(d);
      const hr  = d.getHours();
      grid[day][hr] += t.amount;
    }

    const allVals = grid.flat();
    const max = Math.max(...allVals, 1);
    const obs = computeObservation(grid, max);

    return { heatMap: grid, maxSpend: max, observation: obs };
  }, [transactions]);

  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-base font-bold text-text-primary">🕐 Spending Heatmap</h2>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-4 overflow-x-auto"
        style={{ backgroundColor: '#16162A' }}
      >
        {/* Hour axis labels */}
        <div className="grid gap-px mb-1" style={{ gridTemplateColumns: '28px repeat(24, 1fr)' }}>
          <div /> {/* empty corner */}
          {HOURS.map((h) => (
            <div key={h} className="text-center font-mono" style={{ fontSize: '7px', color: '#8B8A9E' }}>
              {h % 6 === 0 ? (h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h-12}p`) : ''}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {DAY_LABELS.map((day, di) => (
          <div key={day} className="grid gap-px mb-px" style={{ gridTemplateColumns: '28px repeat(24, 1fr)' }}>
            {/* Day label */}
            <div
              className="flex items-center font-body text-right pr-1"
              style={{ fontSize: '9px', color: '#8B8A9E' }}
            >
              {day}
            </div>
            {HOURS.map((h) => {
              const spend = heatMap[di]?.[h] || 0;
              return (
                <div
                  key={h}
                  title={spend > 0 ? `${day} ${h}:00 — ${fmt(spend)}` : ''}
                  className="rounded-sm transition-colors"
                  style={{
                    height: '18px',
                    backgroundColor: heatColor(spend, maxSpend),
                    cursor: spend > 0 ? 'default' : 'default',
                  }}
                />
              );
            })}
          </div>
        ))}

        {/* Colour scale legend */}
        <div className="flex items-center justify-end gap-2 mt-3">
          <span className="font-body text-[9px] text-text-secondary">Less</span>
          {[0.1, 0.3, 0.55, 0.75, 0.95].map((a) => (
            <div
              key={a}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: `rgba(124,58,237,${a})` }}
            />
          ))}
          <span className="font-body text-[9px] text-text-secondary">More</span>
        </div>
      </motion.div>

      {/* Observation */}
      {(insight?.pattern || observation) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3 px-4 py-3 rounded-2xl"
          style={{ backgroundColor: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)' }}
        >
          <span className="text-base flex-shrink-0 mt-0.5">🔍</span>
          <p className="font-body text-sm text-text-primary leading-relaxed">
            {insight?.pattern || observation}
          </p>
        </motion.div>
      )}
    </div>
  );
}
