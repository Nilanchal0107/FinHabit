/**
 * SmartRecommendations.jsx
 * Displays 3 AI tips from the latest insight.
 * Tracks dismissed/accepted tips in Firestore users/{uid}/profile/acceptedTips.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { useUIStore } from '@store/uiStore.js';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n || 0);

// ── Tip card ──────────────────────────────────────────────────────────────────

function TipCard({ tip, saving, index, isAccepted, isDismissed, onAccept, onDismiss }) {
  const ICONS = ['💡', '🎯', '💰'];
  const COLORS = [
    { bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)', accent: '#A78BFA' },
    { bg: 'rgba(79,70,229,0.08)',  border: 'rgba(79,70,229,0.2)',  accent: '#818CF8' },
    { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', accent: '#F59E0B' },
  ];
  const { bg, border, accent } = COLORS[index % COLORS.length];

  if (isDismissed) return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,  scale: 1 }}
      exit={{ opacity: 0, x: -40, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="rounded-2xl p-4 space-y-3"
      style={{ backgroundColor: bg, border: `1px solid ${border}` }}
    >
      {/* Icon + tip text */}
      <div className="flex gap-3">
        <span className="text-xl flex-shrink-0 mt-0.5">{ICONS[index % ICONS.length]}</span>
        <p className="font-body text-sm text-text-primary leading-relaxed">{tip}</p>
      </div>

      {/* Estimated saving */}
      {saving > 0 && (
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}
        >
          <span className="text-xs">💚</span>
          <span className="font-mono text-xs font-semibold" style={{ color: '#22C55E' }}>
            Save {fmt(saving)}/month
          </span>
        </div>
      )}

      {/* CTA buttons */}
      <div className="flex gap-2">
        {isAccepted ? (
          <div
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-body text-xs font-semibold"
            style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: '#22C55E' }}
          >
            ✓ Saved to reminders
          </div>
        ) : (
          <>
            <button
              onClick={onDismiss}
              className="flex-1 py-2 rounded-xl font-body text-xs border border-white/8 text-text-secondary hover:text-text-primary transition-colors"
              style={{ backgroundColor: '#0F0F1A' }}
              id={`tip-dismiss-${index}`}
            >
              Sounds good 👍
            </button>
            <button
              onClick={onAccept}
              className="flex-1 py-2 rounded-xl font-body text-xs font-semibold text-white transition-transform active:scale-95"
              style={{ background: `linear-gradient(135deg, ${accent}cc, ${accent})` }}
              id={`tip-remind-${index}`}
            >
              🔔 Remind me
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── SmartRecommendations ──────────────────────────────────────────────────────

export default function SmartRecommendations({ insight }) {
  const { user }      = useAuthStore();
  const { addToast }  = useUIStore();
  const uid           = user?.uid;

  const [acceptedTips,  setAcceptedTips]  = useState(new Set());
  const [dismissedTips, setDismissedTips] = useState(new Set());

  // ── Load accepted tips from Firestore ─────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, 'users', uid, 'profile', 'data')).then((snap) => {
      if (snap.exists()) {
        const tips = snap.data()?.acceptedTips || [];
        setAcceptedTips(new Set(tips));
      }
    }).catch(() => {});
  }, [uid]);

  // ── Save accepted tip to Firestore ────────────────────────────────────────
  const handleAccept = async (tipText) => {
    if (!uid) return;
    const next = new Set(acceptedTips);
    next.add(tipText);
    setAcceptedTips(next);
    try {
      const ref = doc(db, 'users', uid, 'profile', 'data');
      await setDoc(ref, { acceptedTips: [...next] }, { merge: true });
      addToast({ type: 'success', title: 'Tip saved 🔔', message: 'We\'ll remind you about this.' });
    } catch {
      addToast({ type: 'error', title: 'Could not save tip', message: 'Please try again.' });
    }
  };

  const handleDismiss = (tipText) => {
    setDismissedTips((prev) => new Set([...prev, tipText]));
  };

  // Build tip list from insight (single tip from latest insight + placeholder tips)
  const tips = [];
  if (insight?.tip) {
    tips.push({ text: insight.tip, saving: insight.estimatedSaving || 0 });
  }
  // Pad with sub-insights derived from pattern if available
  if (insight?.pattern && tips.length < 3) {
    tips.push({ text: insight.pattern, saving: 0 });
  }

  if (!tips.length) {
    return (
      <div className="space-y-3">
        <h2 className="font-heading text-base font-bold text-text-primary">🎯 Smart Tips</h2>
        <div className="flex flex-col items-center gap-2 py-8 rounded-3xl text-center"
          style={{ border: '1px dashed rgba(255,255,255,0.1)' }}>
          <span className="text-3xl">🤖</span>
          <p className="font-body text-sm text-text-secondary">Generate an insight to see personalised tips</p>
        </div>
      </div>
    );
  }

  const allDismissed = tips.every((t) => dismissedTips.has(t.text));

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-base font-bold text-text-primary">🎯 Smart Tips</h2>
      <AnimatePresence>
        {allDismissed ? (
          <motion.div
            key="all-done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-2 py-8 rounded-3xl text-center"
            style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}
          >
            <span className="text-3xl">🎉</span>
            <p className="font-body text-sm text-text-primary font-medium">You're on top of it!</p>
            <p className="font-body text-xs text-text-secondary">Refresh for new tips next week.</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {tips.map((t, i) => (
              <TipCard
                key={t.text}
                tip={t.text}
                saving={t.saving}
                index={i}
                isAccepted={acceptedTips.has(t.text)}
                isDismissed={dismissedTips.has(t.text)}
                onAccept={() => handleAccept(t.text)}
                onDismiss={() => handleDismiss(t.text)}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
