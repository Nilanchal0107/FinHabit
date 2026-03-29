import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { useUIStore } from '@store/uiStore.js';
import { useTransactions } from '@hooks/useTransactions.js';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

const FALLBACK_COLORS = [
  '#4F46E5', '#7C3AED', '#0D9488', '#F59E0B', '#F43F5E', '#22C55E',
  '#E879F9', '#38BDF8', '#FB923C', '#A3E635',
];

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function SpendingPieChartSkeleton() {
  return (
    <div className="rounded-2xl p-5 animate-pulse" style={{ background: '#16162A' }}>
      <div className="h-4 w-40 rounded bg-white/10 mb-4" />
      <div className="mx-auto w-44 h-44 rounded-full bg-white/10 mb-4" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-3 rounded bg-white/10" style={{ width: `${80 - i * 10}%` }} />
        ))}
      </div>
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value, pct } = payload[0].payload;
  return (
    <div
      className="rounded-xl px-3 py-2 text-sm font-body shadow-xl"
      style={{ background: '#1E1E35', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <p className="font-semibold text-text-primary">{name}</p>
      <p className="text-text-secondary">{fmt(value)} · {pct}%</p>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function ChartLegend({ data, activeCategory, onSliceClick }) {
  return (
    <div className="mt-4 space-y-2">
      {data.map((entry) => (
        <motion.button
          key={entry.name}
          onClick={() => onSliceClick(entry.name)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left"
          style={{
            background: activeCategory === entry.name ? 'rgba(79,70,229,0.12)' : 'transparent',
            border: `1px solid ${activeCategory === entry.name ? 'rgba(79,70,229,0.3)' : 'transparent'}`,
          }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="flex-1 text-sm font-body text-text-primary truncate">{entry.icon} {entry.name}</span>
          <span className="text-xs font-mono text-text-secondary">{fmt(entry.value)}</span>
          <span className="text-xs font-body w-10 text-right" style={{ color: entry.color }}>{entry.pct}%</span>
        </motion.button>
      ))}
    </div>
  );
}

// ── SpendingPieChart ──────────────────────────────────────────────────────────

export default function SpendingPieChart() {
  const { user } = useAuthStore();
  const uid = user?.uid;
  const { activeCategory, setActiveCategory, clearActiveCategory } = useUIStore();
  const [categoryMeta, setCategoryMeta] = useState({});

  // Category metadata (color, icon) from Firestore — not sensitive, fine to read directly
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(collection(db, 'users', uid, 'categories'), (snap) => {
      const meta = {};
      snap.docs.forEach((d) => { const data = d.data(); meta[data.name] = { color: data.color, icon: data.icon }; });
      setCategoryMeta(meta);
    }, () => {});
    return () => unsub();
  }, [uid]);

  // Decrypted transactions from shared hook
  const { transactions, isLoading } = useTransactions('month');

  if (isLoading) return <SpendingPieChartSkeleton />;

  // Build category totals from decrypted amounts
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const categoryTotals = {};
  transactions.forEach((t) => {
    if (t.transactionType !== 'debit') return;
    const d = t.date ? new Date(t.date) : null;
    if (!d || d < monthStart || d > monthEnd) return;
    if (!t.category) return;
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + (t.amount || 0);
  });

  const total = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-2" style={{ background: '#16162A', minHeight: 200 }}>
        <span className="text-4xl">🥧</span>
        <p className="font-heading text-sm text-text-secondary">No spending this month yet</p>
      </div>
    );
  }

  const top = sorted.slice(0, 5);
  const othersTotal = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
  const chartData = [
    ...top.map(([name, value], i) => ({
      name, value,
      pct: total > 0 ? Math.round((value / total) * 100) : 0,
      color: categoryMeta[name]?.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      icon: categoryMeta[name]?.icon || '💳',
    })),
    ...(othersTotal > 0 ? [{ name: 'Others', value: othersTotal, pct: total > 0 ? Math.round((othersTotal / total) * 100) : 0, color: '#4B5563', icon: '📦' }] : []),
  ];

  const handleSlice = (name) => activeCategory === name ? clearActiveCategory() : setActiveCategory(name);

  return (
    <div className="rounded-2xl p-5" style={{ background: '#16162A' }}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-heading text-sm font-bold text-text-primary uppercase tracking-widest">Spending by Category</h3>
        {activeCategory && (
          <button onClick={clearActiveCategory} className="text-xs font-body text-primary hover:underline">Clear filter ✕</button>
        )}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%" cy="50%"
            innerRadius={60} outerRadius={95}
            paddingAngle={2} dataKey="value"
            animationBegin={0} animationDuration={700}
            onClick={(entry) => handleSlice(entry.name)}
            cursor="pointer"
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.color}
                opacity={activeCategory && activeCategory !== entry.name ? 0.3 : 1}
                stroke={activeCategory === entry.name ? '#fff' : 'transparent'}
                strokeWidth={activeCategory === entry.name ? 2 : 0}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <ChartLegend data={chartData} activeCategory={activeCategory} onSliceClick={handleSlice} />
    </div>
  );
}
