import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { onSnapshot, doc } from 'firebase/firestore';
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

export function MonthEndForecastSkeleton() {
  return (
    <div className="rounded-2xl p-5 animate-pulse" style={{ background: '#16162A' }}>
      <div className="h-4 w-36 rounded bg-white/10 mb-3" />
      <div className="h-3 w-full rounded bg-white/10 mb-2" />
      <div className="h-8 w-48 rounded bg-white/10 mt-3" />
    </div>
  );
}

// ── SVG Trend Line ────────────────────────────────────────────────────────────

function TrendLine({ points, color }) {
  if (!points || points.length < 2) return null;
  const W = 200, H = 40;
  const maxVal = Math.max(...points, 1);
  const mapped = points.map((v, i) => ({
    x: (i / (points.length - 1)) * W,
    y: H - (v / maxVal) * H,
  }));
  const d = mapped.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return (
    <svg width={W} height={H} className="overflow-visible" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {mapped.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} />)}
    </svg>
  );
}

// ── MonthEndForecast ──────────────────────────────────────────────────────────

export default function MonthEndForecast() {
  const { user } = useAuthStore();
  const uid = user?.uid;
  const [income, setIncome] = useState(0);

  // Profile (income — stored unencrypted by client during onboarding)
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid, 'profile', 'data'), (snap) => {
      if (snap.exists()) {
        const v = parseFloat(snap.data()?.monthlyIncome);
        setIncome(isNaN(v) ? 0 : v);
      }
    }, () => {});
    return () => unsub();
  }, [uid]);

  // Decrypted transactions (current month)
  const { transactions, isLoading } = useTransactions('month');

  if (isLoading) return <MonthEndForecastSkeleton />;

  // Build daily cumulative spend trend
  const dailyMap = {};
  transactions.forEach((t) => {
    if (t.transactionType !== 'debit' || !t.date) return;
    const day = new Date(t.date).getDate();
    dailyMap[day] = (dailyMap[day] || 0) + (t.amount || 0);
  });

  const today = new Date().getDate();
  let cum = 0;
  const pts = [];
  for (let day = 1; day <= today; day++) {
    cum += dailyMap[day] || 0;
    pts.push(cum);
  }
  const totalSpent = cum;

  const velocity = totalSpent / daysElapsed();
  const projected = totalSpent + velocity * daysLeft();
  const onTrack   = income > 0 ? projected <= income : true;
  const overspend = projected - income;

  const statusColor = onTrack ? '#22C55E' : '#F43F5E';
  const statusText  = onTrack
    ? 'On track to finish within budget'
    : `Projected to overspend by ${fmt(overspend)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5"
      style={{ background: '#16162A', border: `1px solid ${statusColor}22` }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading text-sm font-bold text-text-primary uppercase tracking-widest">
          Month-End Forecast
        </h3>
        <span
          className="text-xs font-body font-medium px-2 py-0.5 rounded-full"
          style={{ background: `${statusColor}18`, color: statusColor }}
        >
          {onTrack ? '✓ On Track' : '⚠ Over Budget'}
        </span>
      </div>

      <div className="mb-4 overflow-x-auto">
        <TrendLine points={pts} color={statusColor} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Spent So Far',    value: fmt(totalSpent), color: '#F0EFF8' },
          { label: 'Projected Total', value: fmt(projected),  color: statusColor },
          { label: 'Daily Velocity',  value: fmt(velocity),   color: '#F59E0B' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p className="text-[10px] font-body text-text-secondary mb-0.5">{label}</p>
            <p className="font-mono text-sm font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      <p
        className="mt-3 text-xs font-body px-3 py-2 rounded-lg"
        style={{ background: `${statusColor}10`, color: statusColor }}
      >
        {statusText}
      </p>
    </motion.div>
  );
}
