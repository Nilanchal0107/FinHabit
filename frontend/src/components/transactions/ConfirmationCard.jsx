/**
 * ConfirmationCard.jsx
 * Adapts UI based on AI confidence score:
 *   > 0.90  → High   (green, one-tap save)
 *   0.70–0.90 → Medium (amber, "Is this correct?")
 *   < 0.70  → Low    (coral, full edit form)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_CATEGORIES, CATEGORY_MAP } from '@utils/categories.js';
import { useUIStore } from '@store/uiStore.js';

// ── Tier label ────────────────────────────────────────────────────────────────

function TierBadge({ tier }) {
  const labels = { 0: 'Pattern', 1: 'Regex', 2: 'AI', 3: 'Deep AI' };
  const colors = { 0: '#22C55E', 1: '#4F46E5', 2: '#F59E0B', 3: '#F43F5E' };
  return (
    <span
      className="font-mono text-xs px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${colors[tier] || '#6B7280'}22`, color: colors[tier] || '#6B7280' }}
    >
      Tier {tier} — {labels[tier] || 'Unknown'}
    </span>
  );
}

// ── Category selector ─────────────────────────────────────────────────────────

function CategorySelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 rounded-xl font-body text-sm text-text-primary border border-white/10 focus:border-primary outline-none appearance-none"
      style={{ backgroundColor: '#0F0F1A' }}
    >
      {DEFAULT_CATEGORIES.map((cat) => (
        <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
      ))}
    </select>
  );
}

// ── Editable field ─────────────────────────────────────────────────────────────

function EditableField({ label, value, onChange, type = 'text', prefix, suffix }) {
  return (
    <div className="space-y-1">
      <label className="block font-body text-xs text-text-secondary">{label}</label>
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 focus-within:border-primary transition-colors"
        style={{ backgroundColor: '#0F0F1A' }}
      >
        {prefix && <span className="font-body text-text-secondary text-sm flex-shrink-0">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent font-body text-sm text-text-primary outline-none"
        />
        {suffix && <span className="font-body text-text-secondary text-sm flex-shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Success animation ─────────────────────────────────────────────────────────

function SuccessCheck() {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="flex flex-col items-center gap-3 py-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.3, 1] }}
        transition={{ duration: 0.5, times: [0, 0.7, 1] }}
        className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
        style={{ background: 'linear-gradient(135deg,#22C55E,#10B981)' }}
      >
        ✓
      </motion.div>
      <p className="font-heading text-lg font-bold text-success">Transaction Saved!</p>
    </motion.div>
  );
}

// ── Main ConfirmationCard ─────────────────────────────────────────────────────

export default function ConfirmationCard({ data, onConfirm, onCancel, isSaving }) {
  const { addToast } = useUIStore();
  const [saved, setSaved]           = useState(false);
  const [editMode, setEditMode]     = useState(false);

  // Editable state (initialised from parsed data)
  const [amount,   setAmount]   = useState(String(data.amount || ''));
  const [merchant, setMerchant] = useState(data.merchant || '');
  const [category, setCategory] = useState(data.category || 'Others');
  const [payMethod, setPayMethod] = useState(data.paymentMethod || 'UPI');
  const [notes,    setNotes]    = useState('');
  // Derive today's date in IST (guards against UTC date being behind IST before 05:30)
  const [date,     setDate]     = useState(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // 'en-CA' → YYYY-MM-DD
  });

  const confidence = data.confidence ?? 0;
  const isHigh   = confidence >= 0.9;
  const isMedium = confidence >= 0.7 && confidence < 0.9;
  // low = confidence < 0.7 → always edit mode

  const borderColor = isHigh ? '#22C55E' : isMedium ? '#F59E0B' : '#F43F5E';
  const heading = isHigh
    ? null
    : isMedium
    ? 'Is this correct?'
    : 'Please review — AI wasn\'t sure';

  // Resolve category icon
  const catEntry = DEFAULT_CATEGORIES.find(
    (c) => c.name.toLowerCase() === (category || '').toLowerCase()
  ) || CATEGORY_MAP['other'];

  const canSave = amount && parseFloat(amount) > 0 && merchant.trim();

  const handleSave = async () => {
    if (!canSave) return;
    // If the chosen date is today (IST), use the real current time.
    // For any other date, anchor to noon IST (06:30 UTC) so UTC storage never
    // rolls the calendar date backward for IST users.
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
    let txnDate;
    if (date === todayIST) {
      txnDate = new Date().toISOString(); // actual current moment
    } else {
      const [y, mo, d] = date.split('-').map(Number);
      txnDate = new Date(Date.UTC(y, mo - 1, d, 6, 30, 0)).toISOString(); // noon IST
    }
    const result = await onConfirm({
      amount:          parseFloat(amount),
      merchant:        merchant.trim(),
      category,
      paymentMethod:   payMethod,
      transactionType: data.transactionType || 'debit',
      date:            txnDate,
      notes:           notes.trim() || undefined,
      confidence:      data.confidence,
      tier:            data.tier,
    });
    if (result) {
      setSaved(true);
      addToast({ type: 'success', title: 'Transaction saved ✓', message: `${merchant} — ₹${amount}` });
      setTimeout(() => onCancel(), 1500);
    }
  };

  if (saved) {
    return <SuccessCheck />;
  }

  const PAYMENT_METHODS = ['UPI', 'Card', 'Cash', 'NetBanking'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border p-5 space-y-4"
      style={{ borderColor, backgroundColor: '#16162A' }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: `${catEntry?.color || '#6B7280'}22` }}
          >
            {catEntry?.icon || '📦'}
          </div>
          <div>
            {heading && (
              <p className="font-body text-xs font-semibold mb-0.5" style={{ color: borderColor }}>
                {heading}
              </p>
            )}
            <p className="font-heading text-lg font-bold text-text-primary leading-tight">{merchant}</p>
            <p className="font-body text-xs text-text-secondary">{category}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p
            className="font-mono text-2xl font-bold"
            style={{ color: data.transactionType === 'credit' ? '#22C55E' : '#F0EFF8' }}
          >
            {data.transactionType === 'credit' ? '+' : '-'}₹{parseFloat(amount).toLocaleString('en-IN')}
          </p>
          <TierBadge tier={data.tier} />
        </div>
      </div>

      {/* Edit mode OR display mode */}
      <AnimatePresence mode="wait">
        {(editMode || confidence < 0.7) ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            <EditableField
              label="Amount (₹)"
              value={amount}
              onChange={setAmount}
              type="number"
              prefix="₹"
            />
            <EditableField
              label="Merchant"
              value={merchant}
              onChange={setMerchant}
            />
            <div className="space-y-1">
              <label className="block font-body text-xs text-text-secondary">Category</label>
              <CategorySelect value={category} onChange={setCategory} />
            </div>
            <div className="space-y-1">
              <label className="block font-body text-xs text-text-secondary">Payment Method</label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    className={`px-3 py-1.5 rounded-xl font-body text-xs border transition-all ${
                      payMethod === m
                        ? 'border-primary text-white'
                        : 'border-white/10 text-text-secondary'
                    }`}
                    style={payMethod === m ? { backgroundColor: 'rgba(79,70,229,0.25)' } : { backgroundColor: '#0F0F1A' }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="block font-body text-xs text-text-secondary">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl font-body text-sm text-text-primary border border-white/10 focus:border-primary outline-none"
                style={{ backgroundColor: '#0F0F1A', colorScheme: 'dark' }}
              />
            </div>
            <EditableField
              label="Notes (optional)"
              value={notes}
              onChange={(v) => setNotes(v.slice(0, 200))}
              suffix={`${notes.length}/200`}
            />
          </motion.div>
        ) : (
          <motion.div
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between text-sm font-body">
              <span className="text-text-secondary">Payment</span>
              <span className="text-text-primary">{payMethod}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-body">
              <span className="text-text-secondary">Date</span>
              <span className="text-text-primary">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-body">
              <span className="text-text-secondary">Type</span>
              <span
                className="capitalize font-medium"
                style={{ color: data.transactionType === 'credit' ? '#22C55E' : '#F43F5E' }}
              >
                {data.transactionType}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="space-y-2 pt-1">
        {isHigh && !editMode ? (
          // High confidence — one tap save
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3.5 rounded-2xl font-body font-semibold text-white transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#22C55E,#10B981)' }}
          >
            {isSaving ? (
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : '✓ Save Transaction'}
          </button>
        ) : isMedium && !editMode ? (
          // Medium confidence — two buttons
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-3 rounded-2xl font-body font-semibold text-white transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#22C55E,#10B981)' }}
            >
              {isSaving ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : '✓ Yes, Save'}
            </button>
            <button
              onClick={() => setEditMode(true)}
              className="flex-1 py-3 rounded-2xl font-body font-medium border border-white/10 text-text-secondary hover:text-text-primary transition-colors"
              style={{ backgroundColor: '#0F0F1A' }}
            >
              ✏️ Edit
            </button>
          </div>
        ) : (
          // Low confidence OR edit mode — full save button
          <button
            onClick={handleSave}
            disabled={isSaving || !canSave}
            className="w-full py-3.5 rounded-2xl font-body font-semibold text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
          >
            {isSaving ? (
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : 'Save Transaction'}
          </button>
        )}

        {/* Edit link for high confidence */}
        {isHigh && !editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="w-full text-center font-body text-xs text-text-secondary hover:text-text-primary transition-colors py-1"
          >
            Edit details
          </button>
        )}
      </div>
    </motion.div>
  );
}
