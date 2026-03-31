/**
 * BudgetManager.jsx — Set monthly budget limits per category.
 * Reads/writes to Firestore: users/{uid}/budgets/{categoryId}
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { useUIStore } from '@store/uiStore.js';
import { DEFAULT_CATEGORIES } from '@utils/categories.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatINR = (num) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);

// ── Budget Row ────────────────────────────────────────────────────────────────

function BudgetRow({ category, budget, onUpdate }) {
  const [limit, setLimit] = useState(budget?.limit ?? '');
  const [rollover, setRollover] = useState(budget?.rollover ?? false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLimit(budget?.limit ?? '');
    setRollover(budget?.rollover ?? false);
    setDirty(false);
  }, [budget]);

  const handleSave = () => {
    onUpdate(category.id, {
      limit: parseFloat(limit) || 0,
      rollover,
    });
    setDirty(false);
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5"
      style={{ backgroundColor: '#16162A' }}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
        style={{ backgroundColor: category.color + '20' }}
      >
        {category.icon}
      </div>

      {/* Name + Limit input */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="font-body text-sm font-medium text-text-primary truncate">{category.name}</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 focus-within:border-primary transition-colors" style={{ backgroundColor: '#0F0F1A' }}>
            <span className="font-body text-xs text-text-secondary">₹</span>
            <input
              type="number"
              inputMode="numeric"
              value={limit}
              onChange={(e) => { setLimit(e.target.value); setDirty(true); }}
              placeholder="0"
              className="w-20 bg-transparent font-mono text-sm text-text-primary outline-none"
            />
          </div>

          {/* Rollover toggle */}
          <button
            onClick={() => { setRollover(!rollover); setDirty(true); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-body text-xs border transition-all ${
              rollover
                ? 'border-teal/50 text-teal'
                : 'border-white/10 text-text-secondary hover:border-white/20'
            }`}
            style={rollover ? { backgroundColor: 'rgba(13,148,136,0.1)' } : {}}
            title="Carry unused budget to next month"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Rollover
          </button>
        </div>
      </div>

      {/* Save indicator */}
      <AnimatePresence>
        {dirty && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSave}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: '#22C55E' }}
            aria-label="Save budget"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function BudgetManager() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();

  const [budgets, setBudgets] = useState({});
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ── Fetch budgets ───────────────────────────────────────────────────────────

  const fetchBudgets = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'budgets'));
      const data = {};
      snap.forEach((d) => { data[d.id] = d.data(); });
      setBudgets(data);
    } catch (err) {
      console.error('[BudgetManager] Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  // ── Update a single budget ──────────────────────────────────────────────────

  const handleUpdate = async (categoryId, { limit, rollover }) => {
    if (!user?.uid) return;
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'budgets', categoryId),
        { limit, rollover, updatedAt: new Date() },
        { merge: true }
      );
      setBudgets((prev) => ({
        ...prev,
        [categoryId]: { limit, rollover, updatedAt: new Date() },
      }));
      addToast({ type: 'success', title: 'Budget saved', message: `${formatINR(limit)} limit set` });
    } catch (err) {
      addToast({ type: 'error', title: 'Save failed', message: err.message });
    }
  };

  // ── Reset all budgets ───────────────────────────────────────────────────────

  const handleResetAll = async () => {
    if (!user?.uid) return;
    try {
      const batch = writeBatch(db);
      const snap = await getDocs(collection(db, 'users', user.uid, 'budgets'));
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();

      setBudgets({});
      setShowResetConfirm(false);
      addToast({ type: 'success', title: 'Budgets reset', message: 'All budget limits cleared' });
    } catch (err) {
      addToast({ type: 'error', title: 'Reset failed', message: err.message });
    }
  };

  // ── Total budget ────────────────────────────────────────────────────────────

  const totalBudget = Object.values(budgets).reduce((sum, b) => sum + (b.limit || 0), 0);
  const activeBudgets = Object.values(budgets).filter((b) => (b.limit || 0) > 0).length;

  // ── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl" style={{ backgroundColor: '#1E1E36' }} />
        ))}
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Summary bar */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/5"
        style={{ backgroundColor: '#16162A' }}
      >
        <div>
          <p className="font-body text-xs text-text-secondary">Total Monthly Budget</p>
          <p className="font-heading text-lg font-bold text-text-primary">{formatINR(totalBudget)}</p>
        </div>
        <div className="text-right">
          <p className="font-body text-xs text-text-secondary">{activeBudgets} active</p>
          {activeBudgets > 0 && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="font-body text-xs text-coral hover:underline mt-0.5"
            >
              Reset all
            </button>
          )}
        </div>
      </div>

      {/* Budget rows */}
      <div className="space-y-2">
        {DEFAULT_CATEGORIES.filter((c) => c.id !== 'salary' && c.id !== 'transfer').map((cat) => (
          <BudgetRow
            key={cat.id}
            category={cat}
            budget={budgets[cat.id]}
            onUpdate={handleUpdate}
          />
        ))}
      </div>

      {/* Reset confirmation */}
      <AnimatePresence>
        {showResetConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetConfirm(false)}
              className="fixed inset-0 z-50"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-6"
            >
              <div className="w-full max-w-sm rounded-2xl border border-white/10 p-6 space-y-4" style={{ backgroundColor: '#16162A' }}>
                <h3 className="font-heading text-base font-bold text-text-primary text-center">
                  Reset All Budgets?
                </h3>
                <p className="font-body text-sm text-text-secondary text-center">
                  This will remove all category budget limits. You can set them again anytime.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 rounded-2xl font-body font-semibold text-text-secondary border border-white/10 hover:bg-white/5 transition-colors">
                    Cancel
                  </button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleResetAll} className="flex-1 py-3 rounded-2xl font-body font-semibold text-white" style={{ backgroundColor: '#F43F5E' }}>
                    Reset All
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
