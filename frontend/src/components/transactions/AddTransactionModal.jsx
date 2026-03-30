/**
 * AddTransactionModal.jsx
 * Bottom sheet on mobile, centered modal on desktop.
 * Three tabs: Paste SMS | Share Target | Manual Entry
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { useUIStore } from '@store/uiStore.js';
import { useSMSParser } from '@hooks/useSMSParser.js';
import { DEFAULT_CATEGORIES } from '@utils/categories.js';
import { confirmTransaction as apiConfirmTransaction } from '@services/api.js';
import ConfirmationCard from './ConfirmationCard.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const SMS_KEYWORDS = ['debited', 'credited', 'UPI', 'INR', 'Rs.', 'AvlBal', 'NEFT', 'IMPS'];
const PAYMENT_METHODS = ['UPI', 'Card', 'Cash', 'NetBanking'];

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function ParseSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-14 rounded-2xl" style={{ backgroundColor: '#1E1E35' }} />
      <div className="flex gap-3">
        <div className="h-12 rounded-2xl flex-1" style={{ backgroundColor: '#1E1E35' }} />
        <div className="h-12 rounded-2xl w-24" style={{ backgroundColor: '#1E1E35' }} />
      </div>
      <div className="h-28 rounded-2xl" style={{ backgroundColor: '#1E1E35' }} />
    </div>
  );
}

// ─── Tab A — Paste SMS ────────────────────────────────────────────────────────

function PasteSMSTab({ onParsed }) {
  const { isLoading, error, parsedData, parse, confirm, isSaving, reset } = useSMSParser();
  const [smsText, setSmsText] = useState('');
  const [clipboardBanner, setClipboardBanner] = useState(false);
  const textareaRef = useRef(null);

  // Try to pre-fill from clipboard on mount
  useEffect(() => {
    (async () => {
      try {
        const text = await navigator.clipboard.readText();
        const isSMS = SMS_KEYWORDS.some((kw) => text.toLowerCase().includes(kw.toLowerCase()));
        if (isSMS && text.length > 20) {
          setClipboardBanner(true);
          setSmsText(text);
        }
      } catch {
        // Clipboard permission not granted — silent fail
      }
    })();
  }, []);

  const handleParse = async () => {
    if (!smsText.trim() || smsText.trim().length < 10) return;
    const result = await parse(smsText.trim());
    // Clear raw SMS text immediately after sending to backend
    setSmsText('');
    if (result) onParsed(result);
  };

  if (parsedData) {
    return (
      <ConfirmationCard
        data={parsedData}
        onConfirm={confirm}
        onCancel={reset}
        isSaving={isSaving}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Clipboard banner */}
      <AnimatePresence>
        {clipboardBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border"
            style={{ backgroundColor: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.25)' }}
          >
            <span className="text-lg">📋</span>
            <div className="flex-1">
              <p className="font-body text-sm font-medium text-success">Bank SMS detected in clipboard</p>
              <p className="font-body text-xs text-text-secondary">We filled it in for you — review and parse</p>
            </div>
            <button
              onClick={() => { setClipboardBanner(false); setSmsText(''); }}
              className="text-text-secondary hover:text-text-primary text-lg leading-none"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SMS textarea */}
      <div>
        <label className="block font-body text-sm text-text-secondary mb-2">
          Paste your bank SMS here
        </label>
        <textarea
          ref={textareaRef}
          value={smsText}
          onChange={(e) => setSmsText(e.target.value)}
          placeholder={`Example:\n"Dear BOB User: Your account is debited with INR 450.00 on 21-Mar-2026 by ZOMATO LTD UPI Ref No 123456789"`}
          rows={5}
          className="w-full px-4 py-3 rounded-xl font-body text-sm text-text-primary placeholder:text-text-secondary border border-white/10 focus:border-primary outline-none resize-none transition-colors"
          style={{ backgroundColor: '#0F0F1A' }}
        />
        <p className="font-body text-xs text-text-secondary mt-1">
          {smsText.length}/500 characters
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="px-4 py-3 rounded-xl border text-sm font-body"
          style={{ backgroundColor: 'rgba(244,63,94,0.08)', borderColor: 'rgba(244,63,94,0.25)', color: '#F43F5E' }}
        >
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && <ParseSkeleton />}

      {/* Parse button */}
      {!isLoading && (
        <button
          onClick={handleParse}
          disabled={smsText.trim().length < 10}
          className="w-full py-3.5 rounded-2xl font-body font-semibold text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
        >
          Parse SMS →
        </button>
      )}
    </div>
  );
}

// ─── Tab B — Web Share Target ─────────────────────────────────────────────────

function ShareTargetTab() {
  const [searchParams] = useSearchParams();
  const { isLoading, error, parsedData, parse, confirm, isSaving, reset } = useSMSParser();
  const hasParsed = useRef(false);

  const sharedText = searchParams.get('sharedText') || searchParams.get('text') || '';

  useEffect(() => {
    if (sharedText && !hasParsed.current) {
      hasParsed.current = true;
      parse(sharedText);
    }
  }, [sharedText, parse]);

  if (!sharedText) {
    return (
      <div className="text-center py-10 space-y-3">
        <span className="text-4xl block">📤</span>
        <p className="font-heading text-base font-bold text-text-primary">Share SMS directly</p>
        <p className="font-body text-sm text-text-secondary max-w-xs mx-auto">
          Open your Messages app, long-press a bank SMS, tap Share, and choose FinHabits.
        </p>
      </div>
    );
  }

  if (isLoading) return <ParseSkeleton />;

  if (error) {
    return (
      <div className="space-y-4">
        <div
          className="px-4 py-3 rounded-xl border text-sm font-body"
          style={{ backgroundColor: 'rgba(244,63,94,0.08)', borderColor: 'rgba(244,63,94,0.25)', color: '#F43F5E' }}
        >
          {error}
        </div>
        <button
          onClick={() => { hasParsed.current = false; parse(sharedText); }}
          className="w-full py-3.5 rounded-2xl font-body font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (parsedData) {
    return (
      <ConfirmationCard
        data={parsedData}
        onConfirm={confirm}
        onCancel={reset}
        isSaving={isSaving}
      />
    );
  }

  return null;
}

// ─── Tab C — Manual Entry ─────────────────────────────────────────────────────

function ManualEntryTab({ onClose, initialDate, initialMerchant, initialAmount }) {
  const { addToast } = useUIStore();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount:          initialAmount ? String(initialAmount) : '',
    merchant:        initialMerchant || '',
    category:        'food',
    date:            initialDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), // YYYY-MM-DD in IST
    paymentMethod:   'UPI',
    transactionType: 'debit',
    notes:           '',
  });

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const canSave =
    form.amount && parseFloat(form.amount) > 0 &&
    form.merchant.trim().length > 0 &&
    form.category && form.date;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const catEntry = DEFAULT_CATEGORIES.find((c) => c.id === form.category);
      // Build a proper local datetime from the date input:
      //   - If the selected date is today → use the actual current time so the
      //     timestamp is accurate (e.g., "29 Mar, 20:54" not "29 Mar, 00:00")
      //   - Otherwise → use noon local time so UTC conversion never rolls the
      //     date backward for IST users (UTC+5:30)
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // IST YYYY-MM-DD
      let txnDate;
      if (form.date === today) {
        // Use the actual current time (already correct, browser/server time)
        txnDate = new Date().toISOString();
      } else {
        // Build noon IST explicitly: parse date parts and subtract IST offset (UTC+5:30 = +330 min)
        // so that the stored UTC timestamp always maps to the correct IST calendar date.
        const [year, month, day] = form.date.split('-').map(Number);
        // noon IST = 12:00:00 IST = 06:30:00 UTC
        const noonISTasUTC = new Date(Date.UTC(year, month - 1, day, 6, 30, 0));
        txnDate = noonISTasUTC.toISOString();
      }

      await apiConfirmTransaction({
        amount:          parseFloat(form.amount),
        merchant:        form.merchant.trim(),
        category:        catEntry?.name || 'Others',
        date:            txnDate,
        paymentMethod:   form.paymentMethod,
        transactionType: form.transactionType,
        notes:           form.notes.trim() || undefined,
        confidence:      1.0,
        parsingTier:     0,
      });
      addToast({ type: 'success', title: 'Transaction saved ✓', message: `${form.merchant} — ₹${form.amount}` });
      onClose();
    } catch (err) {
      addToast({ type: 'error', title: 'Save failed', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl font-body text-sm text-text-primary placeholder:text-text-secondary border border-white/10 focus:border-primary outline-none transition-colors';
  const inputStyle = { backgroundColor: '#0F0F1A' };

  return (
    <div className="space-y-4">
      {/* Amount */}
      <div className="space-y-1">
        <label className="block font-body text-sm text-text-secondary">Amount</label>
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/10 focus-within:border-primary transition-colors" style={inputStyle}>
          <span className="font-body text-text-secondary">₹</span>
          <input
            type="number"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => update({ amount: e.target.value })}
            placeholder="0.00"
            className="flex-1 bg-transparent font-mono text-text-primary outline-none text-lg"
          />
        </div>
      </div>

      {/* Transaction type */}
      <div className="space-y-1">
        <label className="block font-body text-sm text-text-secondary">Type</label>
        <div className="flex gap-2">
          {['debit', 'credit'].map((t) => (
            <button
              key={t}
              onClick={() => update({ transactionType: t })}
              className={`flex-1 py-2.5 rounded-xl font-body text-sm border capitalize transition-all ${
                form.transactionType === t ? 'border-primary text-white' : 'border-white/10 text-text-secondary'
              }`}
              style={form.transactionType === t ? { backgroundColor: 'rgba(79,70,229,0.25)' } : inputStyle}
            >
              {t === 'debit' ? '📤 Debit' : '📥 Credit'}
            </button>
          ))}
        </div>
      </div>

      {/* Merchant */}
      <div className="space-y-1">
        <label className="block font-body text-sm text-text-secondary">Merchant / Description</label>
        <input
          type="text"
          value={form.merchant}
          onChange={(e) => update({ merchant: e.target.value })}
          placeholder="Zomato, Amazon, Salary..."
          className={inputClass}
          style={inputStyle}
        />
      </div>

      {/* Category */}
      <div className="space-y-1">
        <label className="block font-body text-sm text-text-secondary">Category</label>
        <select
          value={form.category}
          onChange={(e) => update({ category: e.target.value })}
          className={inputClass + ' appearance-none'}
          style={{ ...inputStyle, colorScheme: 'dark' }}
        >
          {DEFAULT_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div className="space-y-1">
        <label className="block font-body text-sm text-text-secondary">Date</label>
        <input
          type="date"
          value={form.date}
          onChange={(e) => update({ date: e.target.value })}
          className={inputClass}
          style={{ ...inputStyle, colorScheme: 'dark' }}
        />
      </div>

      {/* Payment method */}
      <div className="space-y-1">
        <label className="block font-body text-sm text-text-secondary">Payment Method</label>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              onClick={() => update({ paymentMethod: m })}
              className={`px-3 py-2 rounded-xl font-body text-sm border transition-all ${
                form.paymentMethod === m ? 'border-primary text-white' : 'border-white/10 text-text-secondary'
              }`}
              style={form.paymentMethod === m ? { backgroundColor: 'rgba(79,70,229,0.25)' } : inputStyle}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="block font-body text-sm text-text-secondary">Notes (optional)</label>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => update({ notes: e.target.value.slice(0, 200) })}
          placeholder="Add a note..."
          className={inputClass}
          style={inputStyle}
        />
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={!canSave || saving}
        className="w-full py-3.5 rounded-2xl font-body font-semibold text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
      >
        {saving ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : 'Save Transaction'}
      </button>
    </div>
  );
}

// ─── Tabs header ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'sms',    label: '📱 Paste SMS' },
  { id: 'share',  label: '📤 Shared' },
  { id: 'manual', label: '✏️ Manual' },
];

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function AddTransactionModal() {
  const { activeModal, modalData, closeModal } = useUIStore();

  // Determine initial tab from modal trigger
  // If a date is pre-set (from Calendar), default to Manual tab
  const initialTab =
    activeModal === 'manual' ? 'manual' :
    activeModal === 'share'  ? 'share'  :
    (modalData?.date)        ? 'manual' : 'sms';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [parsedResult, setParsedResult] = useState(null);

  const isOpen = ['paste-sms', 'manual', 'share', 'sms'].includes(activeModal);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setParsedResult(null);
    }
  }, [isOpen, initialTab]);

  const handleClose = useCallback(() => {
    closeModal();
    setParsedResult(null);
  }, [closeModal]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    if (isOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          />

          {/* Sheet / Modal */}
          <motion.div
            key="modal"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-50 md:inset-0 md:flex md:items-center md:justify-center md:pointer-events-none"
          >
            <div
              className="relative w-full md:w-full md:max-w-lg md:pointer-events-auto rounded-t-3xl md:rounded-3xl border border-white/10 overflow-hidden"
              style={{ backgroundColor: '#16162A', maxHeight: '92vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle (mobile) */}
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-0 md:hidden" />

              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-4 pb-0">
                <h2 className="font-heading text-lg font-bold text-text-primary">Add Transaction</h2>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                >
                  ×
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mx-6 mt-4 mb-0 p-1 rounded-xl" style={{ backgroundColor: '#0F0F1A' }}>
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-2 rounded-lg font-body text-xs font-medium transition-all duration-200 ${
                      activeTab === tab.id ? 'text-white shadow' : 'text-text-secondary hover:text-text-primary'
                    }`}
                    style={activeTab === tab.id ? { background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' } : {}}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 140px)' }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'sms'    && <PasteSMSTab onParsed={setParsedResult} />}
                    {activeTab === 'share'  && <ShareTargetTab />}
                    {activeTab === 'manual' && (
                      <ManualEntryTab
                        onClose={handleClose}
                        initialDate={modalData?.date}
                        initialMerchant={modalData?.merchant}
                        initialAmount={modalData?.amount}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
