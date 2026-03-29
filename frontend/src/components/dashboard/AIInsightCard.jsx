import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  doc,
} from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { fetchInsights } from '@services/api.js';

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function AIInsightCardSkeleton() {
  return (
    <div className="rounded-2xl p-5 animate-pulse" style={{ background: '#16162A' }}>
      <div className="h-4 w-28 rounded bg-white/10 mb-3" />
      <div className="space-y-2">
        <div className="h-3 rounded bg-white/10 w-full" />
        <div className="h-3 rounded bg-white/10 w-5/6" />
        <div className="h-3 rounded bg-white/10 w-4/6" />
      </div>
    </div>
  );
}

// ── LoadingSkeleton while Groq generates ──────────────────────────────────────

function InsightGeneratingSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[100, 85, 70].map((w) => (
        <div
          key={w}
          className="h-3 rounded-full"
          style={{ background: 'rgba(255,255,255,0.08)', width: `${w}%` }}
        />
      ))}
      <p className="text-xs font-body text-text-secondary mt-3 flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-full bg-violet animate-pulse" />
        Groq is analysing your spending…
      </p>
    </div>
  );
}

// ── AIInsightCard ─────────────────────────────────────────────────────────────

export default function AIInsightCard() {
  const { user } = useAuthStore();
  const uid = user?.uid;

  const [insight, setInsight] = useState(null);  // Latest insight from Firestore
  const [loadingFirestore, setLoadingFirestore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // ── Firestore listener — reads latest weekly insight on mount ──
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'insights'),
      orderBy('generatedAt', 'desc'),
      limit(1)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          setInsight({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
        setLoadingFirestore(false);
      },
      () => setLoadingFirestore(false)
    );
    return () => unsub();
  }, [uid]);

  // ── Refresh: calls GET /api/insights only when user taps ──
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      await fetchInsights('weekly');
      // Firestore onSnapshot will automatically pick up the new doc
    } catch (err) {
      setError(err.message || 'Failed to generate insight');
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  const generatedAt = insight?.generatedAt?.toDate?.() || null;
  const generatedLabel = generatedAt
    ? generatedAt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
    : null;

  if (loadingFirestore) return <AIInsightCardSkeleton />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #16162A 0%, #1A1440 100%)',
        border: '1px solid rgba(124,58,237,0.25)',
      }}
    >
      {/* Purple-to-indigo gradient border strip */}
      <div
        className="h-0.5 w-full"
        style={{ background: 'linear-gradient(90deg, #4F46E5 0%, #7C3AED 50%, #F43F5E 100%)' }}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">✦</span>
            <span className="font-heading text-sm font-bold text-text-primary uppercase tracking-widest">
              AI Insight
            </span>
          </div>
          <motion.button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body font-medium transition-colors"
            style={{
              background: refreshing
                ? 'rgba(124,58,237,0.1)'
                : 'rgba(124,58,237,0.15)',
              color: '#7C3AED',
              border: '1px solid rgba(124,58,237,0.2)',
            }}
            whileTap={{ scale: 0.95 }}
            id="ai-insight-refresh-btn"
          >
            <motion.span
              animate={{ rotate: refreshing ? 360 : 0 }}
              transition={{
                duration: 0.7,
                repeat: refreshing ? Infinity : 0,
                ease: 'linear',
              }}
            >
              ↻
            </motion.span>
            {refreshing ? 'Generating…' : 'Refresh'}
          </motion.button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {refreshing ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <InsightGeneratingSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-sm font-body text-coral">{error}</p>
            </motion.div>
          ) : insight ? (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-sm font-body text-text-primary leading-relaxed">
                {insight.summary}
              </p>
              {insight.recommendations?.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {insight.recommendations.slice(0, 3).map((rec, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm font-body text-text-secondary"
                    >
                      <span style={{ color: '#7C3AED' }}>›</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-sm font-body text-text-secondary">
                No insights yet. Tap Refresh to generate your first weekly insight!
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="mt-4 flex items-center gap-1.5">
          <span className="text-xs font-body text-text-secondary">
            Generated by Groq
          </span>
          {generatedLabel && (
            <>
              <span className="text-text-secondary/30">·</span>
              <span className="text-xs font-body text-text-secondary">
                Refreshed {generatedLabel}
              </span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
