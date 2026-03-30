/**
 * MerchantLoyalty.jsx
 * Top 5 merchants by total lifetime spend.
 * Each row: emoji icon, name, total spend, visit count, avg per visit.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { DEFAULT_CATEGORIES } from '@utils/categories.js';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n || 0);

function fmtCompact(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0, notation: 'compact',
  }).format(n || 0);
}

// Bar width as a percentage of max spend
function barWidth(spend, maxSpend) {
  return maxSpend > 0 ? Math.round((spend / maxSpend) * 100) : 0;
}

// Get a category icon for a merchant by matching the merchant's category field
const CAT_MAP = Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.name.toLowerCase(), c]));
function getCatMeta(categoryName) {
  return CAT_MAP[categoryName?.toLowerCase()] || { icon: '🏪', color: '#6B7280' };
}

// ── Merchant row ──────────────────────────────────────────────────────────────

function MerchantRow({ rank, merchant, total, count, avg, category, maxSpend, delay }) {
  const cat = getCatMeta(category);
  const pct = barWidth(total, maxSpend);

  const RANK_COLORS = ['#F59E0B', '#8B8A9E', '#CD7F32', '#6B7280', '#6B7280'];

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 380, damping: 30 }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{ backgroundColor: '#16162A' }}
    >
      {/* Rank badge */}
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold flex-shrink-0"
        style={{ backgroundColor: `${RANK_COLORS[rank - 1]}18`, color: RANK_COLORS[rank - 1] }}
      >
        {rank}
      </div>

      {/* Category icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
        style={{ backgroundColor: `${cat.color}18` }}
      >
        {cat.icon}
      </div>

      {/* Info + bar */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-body text-sm font-semibold text-text-primary truncate">{merchant}</p>
          <span className="font-mono text-sm font-bold text-text-primary flex-shrink-0">{fmtCompact(total)}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut', delay }}
            className="h-full rounded-full"
            style={{ backgroundColor: cat.color }}
          />
        </div>
        {/* Sub-stats */}
        <div className="flex items-center gap-2">
          <span className="font-body text-[10px] text-text-secondary">
            {count} {count === 1 ? 'visit' : 'visits'}
          </span>
          <span className="w-px h-2.5 bg-white/10" />
          <span className="font-body text-[10px] text-text-secondary">
            avg {fmt(avg)}
          </span>
          {category && (
            <>
              <span className="w-px h-2.5 bg-white/10" />
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded-md font-body text-[9px] font-medium"
                style={{ backgroundColor: `${cat.color}14`, color: cat.color }}
              >
                {category}
              </span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── MerchantLoyalty ───────────────────────────────────────────────────────────

export default function MerchantLoyalty({ transactions }) {
  const merchants = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (t.transactionType !== 'debit' || !t.merchant) continue;
      const key = t.merchant.trim().toLowerCase();
      if (!map[key]) {
        map[key] = { merchant: t.merchant, total: 0, count: 0, category: t.category };
      }
      map[key].total += t.amount;
      map[key].count++;
    }

    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((m) => ({ ...m, avg: m.total / m.count }));
  }, [transactions]);

  const maxSpend = merchants[0]?.total || 1;

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-base font-bold text-text-primary">🏆 Top Merchants</h2>

      {merchants.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center rounded-3xl"
          style={{ border: '1px dashed rgba(255,255,255,0.1)' }}>
          <span className="text-4xl">🏪</span>
          <p className="font-body text-sm text-text-secondary">No merchant data yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {merchants.map((m, i) => (
            <MerchantRow
              key={m.merchant}
              rank={i + 1}
              merchant={m.merchant}
              total={m.total}
              count={m.count}
              avg={m.avg}
              category={m.category}
              maxSpend={maxSpend}
              delay={i * 0.06}
            />
          ))}
        </div>
      )}
    </div>
  );
}
