/**
 * TransactionDetails.jsx
 * Full-screen modal on mobile, centred sheet on desktop.
 * Shows all transaction fields; category + notes are editable.
 * Delete requires typing "DELETE" to confirm.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_CATEGORIES } from '@utils/categories.js';
import { useUIStore } from '@store/uiStore.js';
import { updateTransaction, deleteTransaction } from '@services/api.js';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@store/authStore.js';

// ── helpers ───────────────────────────────────────────────────────────────────

const TIER_META = {
  0: { label: 'Pattern Engine',  color: '#22C55E', desc: 'Matched an existing pattern' },
  1: { label: 'Regex Engine',    color: '#4F46E5', desc: 'Rule-based Indian bank parser' },
  2: { label: 'Groq AI',         color: '#F59E0B', desc: 'Llama 3.1 70B inference' },
  3: { label: 'Vertex AI',       color: '#F43F5E', desc: 'Gemini 1.5 Flash fallback' },
};

function fmtAmount(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2,
  }).format(Math.abs(n));
}

function fmtDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ── sub-components ────────────────────────────────────────────────────────────

function ConfidenceBar({ value }) {
  const pct  = Math.round((value ?? 0) * 100);
  const color = pct >= 90 ? '#22C55E' : pct >= 70 ? '#F59E0B' : '#F43F5E';
  const label = pct >= 90 ? 'High' : pct >= 70 ? 'Medium' : 'Low';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-body text-xs text-text-secondary">AI Confidence</span>
        <span className="font-mono text-xs font-semibold" style={{ color }}>{pct}% — {label}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <span className="font-body text-sm text-text-secondary flex-shrink-0 w-28">{label}</span>
      <div className="flex-1 text-right">{children}</div>
    </div>
  );
}

// ── main modal ────────────────────────────────────────────────────────────────

export default function TransactionDetails({ txn, categoryIcon, onClose, onDeleted, onUpdated }) {
  const { addToast } = useUIStore();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState(txn?.category || 'Others');
  const [notes,    setNotes]    = useState(txn?.notes || '');
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput,       setDeleteInput]       = useState('');

  // Sync state when txn changes
  useEffect(() => {
    if (txn) { setCategory(txn.category || 'Others'); setNotes(txn.notes || ''); }
    setShowDeleteConfirm(false);
    setDeleteInput('');
  }, [txn?.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['transactions', user?.uid] });
  }, [queryClient, user?.uid]);

  const handleSave = async () => {
    if (!txn || saving) return;
    const changed = category !== txn.category || notes !== (txn.notes || '');
    if (!changed) { onClose(); return; }
    setSaving(true);
    try {
      await updateTransaction(txn.id, { category, notes: notes || null });
      invalidate();
      onUpdated?.({ ...txn, category, notes });
      addToast({ type: 'success', title: 'Updated ✓', message: `${txn.merchant} — category saved` });
      onClose();
    } catch (err) {
      addToast({ type: 'error', title: 'Update failed', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteInput !== 'DELETE' || !txn || deleting) return;
    setDeleting(true);
    try {
      await deleteTransaction(txn.id);
      invalidate();
      onDeleted?.(txn.id);
      addToast({ type: 'success', title: 'Deleted', message: `${txn.merchant} removed` });
      onClose();
    } catch (err) {
      addToast({ type: 'error', title: 'Delete failed', message: err.message });
    } finally {
      setDeleting(false);
    }
  };

  if (!txn) return null;

  const isDebit  = txn.transactionType === 'debit';
  const tier     = TIER_META[txn.parsingTier] ?? TIER_META[1];
  const catEntry = DEFAULT_CATEGORIES.find((c) => c.name.toLowerCase() === category.toLowerCase());

  return (
    <AnimatePresence>
      <motion.div
        key="details-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      />

      <motion.div
        key="details-panel"
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="fixed bottom-0 left-0 right-0 z-50 md:inset-0 md:flex md:items-center md:justify-center md:pointer-events-none"
      >
        <div
          className="relative w-full md:max-w-lg md:pointer-events-auto rounded-t-3xl md:rounded-3xl border border-white/10 overflow-y-auto"
          style={{ backgroundColor: '#16162A', maxHeight: '92vh' }}
        >
          {/* Drag handle */}
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 md:hidden" />

          {/* ── Hero ─────────────────────────────────────────────────────────── */}
          <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: catEntry ? `${catEntry.color}22` : 'rgba(79,70,229,0.12)' }}
              >
                {categoryIcon || catEntry?.icon || '💳'}
              </div>
              <div>
                <h2 className="font-heading text-xl font-bold text-text-primary leading-tight">{txn.merchant}</h2>
                <p className="font-body text-sm text-text-secondary mt-0.5">{category}</p>
              </div>
            </div>
            {/* Amount */}
            <div className="text-right flex-shrink-0">
              <p
                className="font-mono text-2xl font-bold"
                style={{ color: isDebit ? '#F43F5E' : '#22C55E' }}
              >
                {isDebit ? '−' : '+'}{fmtAmount(txn.amount)}
              </p>
              <span
                className="inline-block mt-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${tier.color}18`, color: tier.color }}
              >
                T{txn.parsingTier ?? 1}
              </span>
            </div>
          </div>

          {/* ── Fields ───────────────────────────────────────────────────────── */}
          <div className="px-6 pb-2">
            <Field label="Date & Time">
              <span className="font-body text-sm text-text-primary">{fmtDateTime(txn.date)}</span>
            </Field>
            <Field label="Payment">
              <span className="font-body text-sm text-text-primary">{txn.paymentMethod || '—'}</span>
            </Field>
            <Field label="Type">
              <span
                className="font-body text-sm font-medium capitalize"
                style={{ color: isDebit ? '#F43F5E' : '#22C55E' }}
              >
                {txn.transactionType}
              </span>
            </Field>
            <Field label="Parsed by">
              <div className="flex flex-col items-end gap-0.5">
                <span className="font-body text-sm text-text-primary">Tier {txn.parsingTier ?? 1} — {tier.label}</span>
                <span className="font-body text-[10px] text-text-secondary">{tier.desc}</span>
              </div>
            </Field>

            {/* Confidence bar */}
            <div className="py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <ConfidenceBar value={txn.confidence} />
            </div>
          </div>

          {/* ── Editable Category ─────────────────────────────────────────────── */}
          <div className="px-6 py-4 space-y-3">
            <div className="space-y-1.5">
              <label className="block font-body text-sm text-text-secondary">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl font-body text-sm text-text-primary border border-white/10 focus:border-primary outline-none appearance-none"
                style={{ backgroundColor: '#0F0F1A', colorScheme: 'dark' }}
                id="txn-details-category-select"
              >
                {DEFAULT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>

            {/* Editable Notes */}
            <div className="space-y-1.5">
              <label className="block font-body text-sm text-text-secondary">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 200))}
                placeholder="Add a note…"
                className="w-full px-3 py-2.5 rounded-xl font-body text-sm text-text-primary border border-white/10 focus:border-primary outline-none transition-colors"
                style={{ backgroundColor: '#0F0F1A' }}
                id="txn-details-notes-input"
              />
              <p className="font-body text-[10px] text-text-secondary text-right">{notes.length}/200</p>
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3.5 rounded-2xl font-body font-semibold text-white transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
              id="txn-details-save-btn"
            >
              {saving
                ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : 'Save Changes'}
            </button>
          </div>

          {/* ── Delete ────────────────────────────────────────────────────────── */}
          <div className="px-6 pb-8">
            <AnimatePresence>
              {!showDeleteConfirm ? (
                <motion.button
                  key="del-trigger"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-3 rounded-2xl font-body text-sm font-semibold border transition-all"
                  style={{ backgroundColor: 'rgba(244,63,94,0.06)', borderColor: 'rgba(244,63,94,0.2)', color: '#F43F5E' }}
                  id="txn-details-delete-btn"
                >
                  🗑️ Delete Transaction
                </motion.button>
              ) : (
                <motion.div
                  key="del-confirm"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-3"
                >
                  <p className="font-body text-sm text-text-secondary text-center pt-1">
                    Type <span className="font-mono font-bold text-coral">DELETE</span> to confirm
                  </p>
                  <input
                    autoFocus
                    type="text"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder="DELETE"
                    className="w-full px-3 py-2.5 rounded-xl font-mono text-sm text-center border outline-none transition-colors"
                    style={{
                      backgroundColor: '#0F0F1A',
                      borderColor: deleteInput === 'DELETE' ? '#F43F5E' : 'rgba(255,255,255,0.1)',
                      color: deleteInput === 'DELETE' ? '#F43F5E' : '#F0EFF8',
                    }}
                    id="txn-details-delete-confirm-input"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                      className="flex-1 py-2.5 rounded-2xl font-body text-sm border border-white/10 text-text-secondary hover:text-text-primary transition-colors"
                      style={{ backgroundColor: '#0F0F1A' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleteInput !== 'DELETE' || deleting}
                      className="flex-1 py-2.5 rounded-2xl font-body text-sm font-semibold text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-1.5"
                      style={{ backgroundColor: '#F43F5E' }}
                      id="txn-details-delete-confirm-btn"
                    >
                      {deleting
                        ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        : '🗑️ Delete'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
