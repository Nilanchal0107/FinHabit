/**
 * WeeklySummary.jsx
 * Shows the latest Groq-generated insight + previous 4 weeks' history.
 * Refresh button forces a new Groq call (bypasses cache).
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchInsights } from '@services/api.js';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n || 0);

function timeAgo(dateVal) {
  if (!dateVal) return '';
  const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function InsightSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-5 rounded-3xl" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
      <div className="h-3 rounded bg-white/10 w-3/4" />
      <div className="h-3 rounded bg-white/10 w-full" />
      <div className="h-3 rounded bg-white/10 w-5/6" />
      <div className="h-3 rounded bg-white/10 w-2/3 mt-2" />
    </div>
  );
}

// ── Insight card ──────────────────────────────────────────────────────────────

function InsightCard({ insight, isLatest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl p-5 space-y-4 relative overflow-hidden"
      style={{
        background:   isLatest
          ? 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(124,58,237,0.08))'
          : 'rgba(255,255,255,0.03)',
        border:       isLatest
          ? '1px solid rgba(124,58,237,0.35)'
          : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Glow blob — only on latest */}
      {isLatest && (
        <div
          className="absolute -top-10 -right-10 w-32 h-32 rounded-full pointer-events-none"
          style={{ background: 'rgba(124,58,237,0.15)', filter: 'blur(32px)' }}
        />
      )}

      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="font-body text-xs font-semibold text-violet-300" style={{ color: '#A78BFA' }}>
            {isLatest ? 'Latest Insight' : 'Past Insight'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {insight.changePercent !== undefined && (
            <span
              className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: insight.changePercent > 0 ? 'rgba(244,63,94,0.12)' : 'rgba(34,197,94,0.12)',
                color:           insight.changePercent > 0 ? '#F43F5E' : '#22C55E',
              }}
            >
              {insight.changePercent > 0 ? '▲' : '▼'} {Math.abs(insight.changePercent)}%
            </span>
          )}
          <span className="font-body text-[10px] text-text-secondary">
            {timeAgo(insight.generatedAt)}
          </span>
        </div>
      </div>

      {/* Summary */}
      {insight.summary && (
        <div className="space-y-1">
          <p className="font-body text-[10px] uppercase tracking-widest text-text-secondary font-semibold">Overview</p>
          <p className="font-body text-sm text-text-primary leading-relaxed">{insight.summary}</p>
        </div>
      )}

      {/* Pattern */}
      {insight.pattern && (
        <div className="space-y-1">
          <p className="font-body text-[10px] uppercase tracking-widest text-text-secondary font-semibold">Pattern</p>
          <p className="font-body text-sm text-text-primary leading-relaxed">{insight.pattern}</p>
        </div>
      )}

      {/* Tip + saving */}
      {insight.tip && (
        <div
          className="rounded-2xl p-3.5 space-y-1.5"
          style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">💡</span>
            <p className="font-body text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#22C55E' }}>
              Action tip
            </p>
          </div>
          <p className="font-body text-sm text-text-primary leading-relaxed">{insight.tip}</p>
          {insight.estimatedSaving > 0 && (
            <p className="font-mono text-xs font-bold" style={{ color: '#22C55E' }}>
              Potential saving: {fmt(insight.estimatedSaving)}/month
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <p className="font-body text-[9px] text-text-secondary opacity-50">
        Generated by Groq · Llama 3.1 70B · {insight.period === 'weekly' ? 'Refreshed weekly' : 'Monthly'}
      </p>
    </motion.div>
  );
}

// ── WeeklySummary ─────────────────────────────────────────────────────────────

export default function WeeklySummary({ period = 'weekly' }) {
  const { user } = useAuthStore();
  const uid = user?.uid;

  const [latestInsight,  setLatestInsight]  = useState(null);
  const [pastInsights,   setPastInsights]   = useState([]);
  const [loadingLatest,  setLoadingLatest]  = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [showPast,       setShowPast]       = useState(false);

  // ── Firestore real-time listener for insights collection ──────────────────
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'insights'),
      orderBy('generatedAt', 'desc'),
      limit(5)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filtered = docs.filter((d) => d.period === period);
      setLatestInsight(filtered[0] || null);
      setPastInsights(filtered.slice(1));
      setLoadingLatest(false);
    }, () => setLoadingLatest(false));
    return () => unsub();
  }, [uid, period]);

  // ── Refresh: force new Groq call ──────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // fetchInsights(period, force=true) bypasses the 6h Firestore cache
      await fetchInsights(period, true);
      // Firestore onSnapshot listener above picks up the new doc automatically
    } catch (err) {
      console.error('[WeeklySummary] Refresh failed:', err.message);
    } finally {
      setRefreshing(false);
    }
  };

  // ── Trigger on mount if no insight exists ─────────────────────────────────
  useEffect(() => {
    if (!loadingLatest && !latestInsight && uid) {
      handleRefresh();
    }
  }, [loadingLatest, latestInsight, uid]); // eslint-disable-line

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-base font-bold text-text-primary">
          {period === 'weekly' ? '📊 Weekly Summary' : '📊 Monthly Summary'}
        </h2>
        <motion.button
          onClick={handleRefresh}
          disabled={refreshing}
          whileTap={{ scale: 0.92 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-body text-xs font-semibold border transition-all disabled:opacity-50"
          style={{
            backgroundColor: 'rgba(124,58,237,0.1)',
            borderColor:     'rgba(124,58,237,0.3)',
            color:           '#A78BFA',
          }}
          id="insights-refresh-btn"
        >
          <motion.span
            animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
            transition={refreshing ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : {}}
            className="inline-block"
          >
            ↻
          </motion.span>
          {refreshing ? 'Generating…' : 'Refresh'}
        </motion.button>
      </div>

      {/* Latest insight */}
      <AnimatePresence mode="wait">
        {loadingLatest || refreshing
          ? <InsightSkeleton key="skeleton" />
          : latestInsight
          ? <InsightCard key={latestInsight.id} insight={latestInsight} isLatest />
          : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 py-10 text-center rounded-3xl"
              style={{ border: '1px dashed rgba(255,255,255,0.1)' }}
            >
              <span className="text-4xl">🤖</span>
              <p className="font-heading text-sm font-bold text-text-primary">No insights yet</p>
              <p className="font-body text-xs text-text-secondary">Hit Refresh to generate your first AI insight.</p>
            </motion.div>
          )
        }
      </AnimatePresence>

      {/* Past insights accordion */}
      {pastInsights.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowPast((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl font-body text-xs text-text-secondary hover:text-text-primary transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
          >
            <span>Previous insights ({pastInsights.length})</span>
            <span>{showPast ? '▲' : '▼'}</span>
          </button>
          <AnimatePresence>
            {showPast && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-3"
              >
                {pastInsights.map((ins) => (
                  <InsightCard key={ins.id} insight={ins} isLatest={false} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
