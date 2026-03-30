/**
 * TransactionItem.jsx
 * Single row in the transaction list.
 * Swipe left → confirms delete.
 * Swipe right → opens detail / category edit.
 * Tap → opens TransactionDetails modal.
 */

import { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

// ── helpers ───────────────────────────────────────────────────────────────────

const TIER_META = {
  0: { label: 'T0', color: '#F59E0B' },
  1: { label: 'T1', color: '#0D9488' },
  2: { label: 'T2', color: '#F43F5E' },
  3: { label: 'T3', color: '#7C3AED' },
};

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(Math.abs(n));

function fmtTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// ── component ─────────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 72;
const MAX_DRAG        = 96;

export default function TransactionItem({ txn, categoryIcon, onTap, onDeleteRequest }) {
  const x             = useMotionValue(0);
  const draggingRef   = useRef(false);
  const [revealed, setRevealed] = useState(false); // left-swipe delete panel open

  // Background reveals as user swipes left
  const deleteBg  = useTransform(x, [-MAX_DRAG, 0], ['rgba(244,63,94,0.22)', 'rgba(244,63,94,0)']);
  const deleteX   = useTransform(x, [-MAX_DRAG, 0], [0, 32]);
  const editBg    = useTransform(x, [0, MAX_DRAG], ['rgba(79,70,229,0)', 'rgba(79,70,229,0.22)']);

  const tier     = TIER_META[txn.parsingTier] ?? TIER_META[1];
  const isDebit  = txn.transactionType === 'debit';
  const icon     = categoryIcon || '💳';

  const handleDragStart = () => { draggingRef.current = true; };

  const handleDragEnd = (_, info) => {
    setTimeout(() => { draggingRef.current = false; }, 50);

    if (info.offset.x < -SWIPE_THRESHOLD) {
      // Snap to reveal delete panel
      animate(x, -MAX_DRAG, { type: 'spring', stiffness: 500, damping: 35 });
      setRevealed(true);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 35 });
      setRevealed(false);
    }
  };

  const handleTap = () => {
    if (draggingRef.current) return;
    if (revealed) {
      // Swipe back on tap if delete panel is open
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 35 });
      setRevealed(false);
      return;
    }
    onTap(txn);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDeleteRequest(txn);
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 35 });
    setRevealed(false);
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ contain: 'layout style paint' }}
    >
      {/* ── Delete background (left swipe) ──────────────────────────────────── */}
      <motion.div
        style={{ backgroundColor: deleteBg }}
        className="absolute inset-0 flex items-center justify-end rounded-xl"
      >
        <motion.button
          style={{ x: deleteX }}
          onClick={handleDeleteClick}
          className="flex items-center gap-1.5 pr-4 font-body text-sm font-semibold"
          style={{ color: '#F43F5E', x: deleteX }}
        >
          🗑️ Delete
        </motion.button>
      </motion.div>

      {/* ── Edit background (right swipe) ────────────────────────────────────── */}
      <motion.div
        style={{ backgroundColor: editBg }}
        className="absolute inset-0 flex items-center justify-start pl-4 rounded-xl pointer-events-none"
      >
        <span className="font-body text-sm font-semibold text-primary">✏️ Edit</span>
      </motion.div>

      {/* ── Main row ─────────────────────────────────────────────────────────── */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -MAX_DRAG, right: MAX_DRAG }}
        dragElastic={0.05}
        style={{ x }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleTap}
        className="relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer select-none"
        style={{ backgroundColor: '#16162A', touchAction: 'pan-y' }}
        whileTap={{ scale: 0.99 }}
        id={`txn-item-${txn.id}`}
      >
        {/* Category icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ backgroundColor: 'rgba(79,70,229,0.12)' }}
        >
          {icon}
        </div>

        {/* Merchant + meta */}
        <div className="flex-1 min-w-0">
          <p className="font-body text-sm font-semibold text-text-primary truncate">{txn.merchant}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {txn.category && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded-md font-body text-[10px] font-medium"
                style={{ backgroundColor: 'rgba(79,70,229,0.12)', color: '#A5B4FC' }}
              >
                {txn.category}
              </span>
            )}
            <span className="font-body text-[10px] text-text-secondary">{fmtTime(txn.date)}</span>
            <span
              className="inline-flex items-center px-1 py-0.5 rounded font-mono text-[9px] font-bold"
              style={{ backgroundColor: `${tier.color}18`, color: tier.color }}
              title={`Parsing Tier ${txn.parsingTier}`}
            >
              {tier.label}
            </span>
          </div>
        </div>

        {/* Amount */}
        <div className="text-right flex-shrink-0">
          <p
            className="font-mono text-sm font-semibold"
            style={{ color: isDebit ? '#F43F5E' : '#22C55E' }}
          >
            {isDebit ? '−' : '+'}{fmt(txn.amount)}
          </p>
          {txn.paymentMethod && (
            <p className="font-body text-[10px] text-text-secondary mt-0.5">{txn.paymentMethod}</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
