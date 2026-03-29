import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@store/uiStore.js';
import { useTransactions } from '@hooks/useTransactions.js';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

function daysLeft() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function BudgetBurnRateCardsSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex-shrink-0 w-44 h-36 rounded-2xl bg-white/10" />
      ))}
    </div>
  );
}

// ── Single budget card ────────────────────────────────────────────────────────

function BudgetCard({ budget, onTap }) {
  const { name, icon, used, limit } = budget;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const days = daysLeft();
  const barColor = pct >= 90 ? '#F43F5E' : pct >= 70 ? '#F59E0B' : '#22C55E';

  return (
    <motion.button
      onClick={onTap}
      className="flex-shrink-0 w-44 rounded-2xl p-4 text-left"
      style={{ background: '#16162A', border: `1px solid ${barColor}22` }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.97 }}
      id={`budget-card-${name.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl leading-none">{icon}</span>
        <span className="text-xs font-body font-semibold text-text-primary truncate">{name}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden mb-2">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ background: barColor }}
        />
      </div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs font-medium" style={{ color: barColor }}>{fmt(used)}</span>
        <span className="font-mono text-xs text-text-secondary">{fmt(limit)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-body text-xs" style={{ color: barColor }}>{pct}% used</span>
        {days <= 7 && pct >= 80 && (
          <span className="text-[10px] font-body text-coral">⚠ {days}d left</span>
        )}
      </div>
    </motion.button>
  );
}

// ── BudgetBurnRateCards ───────────────────────────────────────────────────────

export default function BudgetBurnRateCards() {
  const { user } = useAuthStore();
  const uid = user?.uid;
  const navigate = useNavigate();
  const { setActiveCategory } = useUIStore();

  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState({});
  const [metaLoading, setMetaLoading] = useState(true);

  // Budgets listener
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(collection(db, 'users', uid, 'budgets'), (snap) => {
      setBudgets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setMetaLoading(false);
    }, () => setMetaLoading(false));
    return () => unsub();
  }, [uid]);

  // Category metadata listener
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(collection(db, 'users', uid, 'categories'), (snap) => {
      const meta = {};
      snap.docs.forEach((d) => { meta[d.id] = d.data(); });
      setCategories(meta);
    }, () => {});
    return () => unsub();
  }, [uid]);

  // Decrypted transactions from shared hook
  const { transactions, isLoading: txnLoading } = useTransactions('month');

  if (metaLoading || txnLoading) return <BudgetBurnRateCardsSkeleton />;

  if (budgets.length === 0) {
    return (
      <div className="rounded-2xl p-4 text-center" style={{ background: '#16162A' }}>
        <p className="text-sm font-body text-text-secondary">No budgets set yet — add them in Settings.</p>
      </div>
    );
  }

  // Spending per category name (debits this month, already filtered by API)
  const spentMap = {};
  transactions.forEach((t) => {
    if (t.transactionType !== 'debit' || !t.category) return;
    spentMap[t.category] = (spentMap[t.category] || 0) + (t.amount || 0);
  });

  const cards = budgets.map((b) => {
    const cat = categories[b.id] || {};
    return {
      id: b.id,
      name:  cat.name  || b.id,
      icon:  cat.icon  || '💳',
      color: cat.color || '#4F46E5',
      limit: parseFloat(b.limit) || 0,
      used:  spentMap[cat.name || b.id] || 0,
    };
  });

  return (
    <div>
      <h3 className="font-heading text-sm font-bold text-text-primary uppercase tracking-widest mb-3">
        Budget Burn Rate
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scroll-smooth">
        {cards.map((card) => (
          <div key={card.id} className="snap-start">
            <BudgetCard
              budget={card}
              onTap={() => { setActiveCategory(card.name); navigate('/transactions'); }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
