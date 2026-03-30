/**
 * RecurringSheet.jsx
 * Bottom sheet that appears when user taps the ↻ recurring badge on a calendar cell.
 * Shows predicted recurring payments and lets user dismiss or confirm when paid.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@store/uiStore.js';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n);

function fmtDateLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
}

export default function RecurringSheet({ dateStr, predictions, onDismiss, onConfirm }) {
  const { openModal } = useUIStore();
  const isOpen = !!dateStr && predictions?.length > 0;

  const handleConfirmPaid = (pred) => {
    // Open AddTransactionModal pre-filled with the merchant + predicted amount
    openModal('manual', {
      date:     dateStr,
      merchant: pred.merchant,
      amount:   Math.round(pred.amount),
    });
    onConfirm?.(pred);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="rec-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          />

          {/* Sheet */}
          <motion.div
            key="rec-sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            className="fixed bottom-0 left-0 right-0 z-50 md:inset-0 md:flex md:items-end md:justify-center md:pointer-events-none"
          >
            <div
              className="w-full md:max-w-lg md:pointer-events-auto rounded-t-3xl border border-white/10 overflow-hidden"
              style={{ backgroundColor: '#16162A' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-0" />

              {/* Header */}
              <div className="px-6 pt-4 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-base font-bold text-text-primary">
                    🔄 Recurring Payments
                  </h3>
                  <p className="font-body text-xs text-text-secondary mt-0.5">
                    Expected on {fmtDateLabel(dateStr)}
                  </p>
                </div>
                <button
                  onClick={onDismiss}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Prediction cards */}
              <div className="px-6 pb-8 space-y-3">
                {predictions.map((pred, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-4 p-4 rounded-2xl border"
                    style={{
                      backgroundColor: 'rgba(124,58,237,0.08)',
                      borderColor: 'rgba(124,58,237,0.2)',
                    }}
                  >
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-semibold text-text-primary truncate">
                        {pred.merchant}
                      </p>
                      <p className="font-mono text-xs mt-0.5" style={{ color: '#A78BFA' }}>
                        {fmt(pred.amount)} expected
                      </p>
                    </div>

                    {/* CTA */}
                    <button
                      onClick={() => handleConfirmPaid(pred)}
                      className="flex-shrink-0 px-3.5 py-2 rounded-xl font-body text-xs font-semibold text-white transition-transform active:scale-95"
                      style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
                      id={`recurring-confirm-${i}`}
                    >
                      Mark Paid
                    </button>
                  </div>
                ))}

                {/* Dismiss all */}
                <button
                  onClick={onDismiss}
                  className="w-full py-3 rounded-2xl font-body text-sm text-text-secondary border border-white/10 hover:text-text-primary transition-colors"
                  style={{ backgroundColor: '#0F0F1A' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
