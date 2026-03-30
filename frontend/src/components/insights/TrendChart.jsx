/**
 * TrendChart.jsx
 * Recharts line chart showing daily spend per top-3 categories.
 * Toggle: Last 30 days / Last 90 days.
 * Click legend item to toggle individual lines.
 */

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { motion } from 'framer-motion';

// ── colour palette for category lines ────────────────────────────────────────

const LINE_COLORS = ['#7C3AED', '#F59E0B', '#22C55E', '#F43F5E', '#3B82F6'];

// ── helpers ───────────────────────────────────────────────────────────────────

function toISTDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

function fmtAxisDate(dateStr) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0, notation: 'compact',
  }).format(n);

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-2xl border px-4 py-3 space-y-1.5 shadow-2xl"
      style={{ backgroundColor: '#1E1E35', borderColor: 'rgba(255,255,255,0.1)' }}
    >
      <p className="font-body text-xs text-text-secondary mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="font-body text-xs text-text-secondary">{p.dataKey}</span>
          </div>
          <span className="font-mono text-xs font-semibold text-text-primary">
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Custom Legend ─────────────────────────────────────────────────────────────

function CustomLegend({ categories, hiddenLines, onToggle }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
      {categories.map((cat, i) => {
        const hidden = hiddenLines.has(cat);
        return (
          <button
            key={cat}
            onClick={() => onToggle(cat)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-body text-[10px] font-medium transition-opacity"
            style={{
              backgroundColor: hidden ? 'rgba(255,255,255,0.04)' : `${LINE_COLORS[i % LINE_COLORS.length]}18`,
              color:           hidden ? '#8B8A9E' : LINE_COLORS[i % LINE_COLORS.length],
              border:          `1px solid ${hidden ? 'transparent' : `${LINE_COLORS[i % LINE_COLORS.length]}44`}`,
              opacity:         hidden ? 0.5 : 1,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hidden ? '#8B8A9E' : LINE_COLORS[i % LINE_COLORS.length] }} />
            {cat}
          </button>
        );
      })}
    </div>
  );
}

// ── TrendChart ────────────────────────────────────────────────────────────────

export default function TrendChart({ transactions }) {
  const [days,        setDays]        = useState(30);
  const [hiddenLines, setHiddenLines] = useState(new Set());

  const toggleLine = (cat) => {
    setHiddenLines((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // ── Build chart data ───────────────────────────────────────────────────────
  const { chartData, topCategories } = useMemo(() => {
    const cutoff = new Date(Date.now() - days * 86_400_000);

    // Filter to window + debit only
    const filtered = transactions.filter((t) => {
      if (t.transactionType !== 'debit' || !t.date) return false;
      return new Date(t.date) >= cutoff;
    });

    // Find top 3 categories by total spend in window
    const catTotals = {};
    for (const t of filtered) {
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    }
    const top3 = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    if (top3.length === 0) return { chartData: [], topCategories: [] };

    // Build date → category spend map
    const dateMap = {};
    for (const t of filtered) {
      if (!top3.includes(t.category)) continue;
      const d = toISTDate(t.date);
      if (!dateMap[d]) dateMap[d] = {};
      dateMap[d][t.category] = (dateMap[d][t.category] || 0) + t.amount;
    }

    // Generate all dates in range
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d   = new Date(Date.now() - i * 86_400_000);
      const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const entry = { date: fmtAxisDate(key) };
      for (const cat of top3) {
        entry[cat] = Math.round(dateMap[key]?.[cat] || 0);
      }
      data.push(entry);
    }

    return { chartData: data, topCategories: top3 };
  }, [transactions, days]);

  const PERIODS = [
    { label: 'Last 30 days', value: 30 },
    { label: 'Last 90 days', value: 90 },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-base font-bold text-text-primary">📈 Spending Trend</h2>
        <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setDays(p.value)}
              className="px-3 py-1 rounded-lg font-body text-xs font-medium transition-all"
              style={{
                backgroundColor: days === p.value ? '#4F46E5' : 'transparent',
                color:           days === p.value ? '#fff'     : '#8B8A9E',
              }}
              id={`trend-toggle-${p.value}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-4"
        style={{ backgroundColor: '#16162A' }}
      >
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="text-4xl">📊</span>
            <p className="font-body text-sm text-text-secondary">Not enough data for trend chart</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#8B8A9E', fontSize: 10, fontFamily: 'Inter, sans-serif' }}
                  axisLine={false} tickLine={false}
                  interval={Math.floor(chartData.length / 6)}
                />
                <YAxis
                  tick={{ fill: '#8B8A9E', fontSize: 10, fontFamily: 'monospace' }}
                  tickFormatter={(v) => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`}
                  axisLine={false} tickLine={false} width={48}
                />
                <Tooltip content={<CustomTooltip />} />
                {topCategories.map((cat, i) => (
                  <Line
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={hiddenLines.has(cat) ? 0 : 2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    hide={hiddenLines.has(cat)}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            <CustomLegend
              categories={topCategories}
              hiddenLines={hiddenLines}
              onToggle={toggleLine}
            />
          </>
        )}
      </motion.div>
    </div>
  );
}
