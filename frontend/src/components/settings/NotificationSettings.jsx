/**
 * NotificationSettings.jsx — Notification preferences.
 * Reads/writes to Firestore: users/{uid}/profile/data → notificationPrefs
 * Requests browser notification permission when any toggle is enabled.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, requestNotificationPermission } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { useUIStore } from '@store/uiStore.js';

// ── Default prefs ─────────────────────────────────────────────────────────────

const DEFAULT_PREFS = {
  pauseAll: false,
  dailyReminder: false,
  dailyReminderTime: '21:00',
  weeklySummary: true,
  monthlyReport: true,
  budgetWarnings: true,
  budgetThreshold: 75,
  anomalyAlerts: true,
  billReminders: false,
};

// ── Toggle component ──────────────────────────────────────────────────────────

function Toggle({ enabled, onChange, disabled }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      }`}
      style={{ backgroundColor: enabled ? '#4F46E5' : '#2A2A44' }}
      role="switch"
      aria-checked={enabled}
    >
      <motion.div
        animate={{ x: enabled ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
      />
    </button>
  );
}

// ── Notification row ──────────────────────────────────────────────────────────

function NotifRow({ icon, title, description, enabled, onChange, disabled, children }) {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-white/5"
      style={{ backgroundColor: '#16162A' }}
    >
      <span className="text-lg mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <p className="font-body text-sm font-medium text-text-primary">{title}</p>
          <Toggle enabled={enabled} onChange={onChange} disabled={disabled} />
        </div>
        <p className="font-body text-xs text-text-secondary mt-0.5">{description}</p>
        {children && enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3"
          >
            {children}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NotificationSettings() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();

  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Fetch prefs ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'profile', 'data'));
        if (snap.exists() && snap.data().notificationPrefs) {
          setPrefs({ ...DEFAULT_PREFS, ...snap.data().notificationPrefs });
        }
      } catch (err) {
        console.error('[NotificationSettings] Fetch error:', err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ── Update a preference ─────────────────────────────────────────────────────

  const updatePref = async (key, value) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);

    // Request notification permission when any toggle is turned ON
    if (value === true && key !== 'pauseAll') {
      try {
        const token = await requestNotificationPermission();
        if (!token) {
          addToast({
            type: 'warning',
            title: 'Notifications blocked',
            message: 'Please enable notifications in your browser settings.',
          });
        }
      } catch {
        // Silent fail — permission not critical
      }
    }

    // Save to Firestore
    if (!user?.uid) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'profile', 'data'),
        { notificationPrefs: newPrefs },
        { merge: true }
      );
    } catch (err) {
      addToast({ type: 'error', title: 'Save failed', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const allDisabled = prefs.pauseAll;

  // ── Loading ─────────────────────────────────────────────────────────────────

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
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* Saving indicator */}
      {saving && (
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="font-body text-xs text-text-secondary">Saving…</span>
        </div>
      )}

      {/* Master toggle */}
      <div
        className="flex items-center gap-3 px-4 py-4 rounded-xl border"
        style={{
          backgroundColor: prefs.pauseAll ? 'rgba(244,63,94,0.08)' : '#16162A',
          borderColor: prefs.pauseAll ? 'rgba(244,63,94,0.25)' : 'rgba(255,255,255,0.05)',
        }}
      >
        <span className="text-lg">🔇</span>
        <div className="flex-1">
          <p className="font-body text-sm font-medium text-text-primary">Pause All Notifications</p>
          <p className="font-body text-xs text-text-secondary">
            Temporarily silence everything
          </p>
        </div>
        <Toggle enabled={prefs.pauseAll} onChange={(v) => updatePref('pauseAll', v)} />
      </div>

      {/* Individual toggles */}
      <NotifRow
        icon="🕘"
        title="Daily Spending Reminder"
        description="Get a summary of today's spending"
        enabled={prefs.dailyReminder}
        onChange={(v) => updatePref('dailyReminder', v)}
        disabled={allDisabled}
      >
        <div className="flex items-center gap-2">
          <span className="font-body text-xs text-text-secondary">Time:</span>
          <input
            type="time"
            value={prefs.dailyReminderTime}
            onChange={(e) => updatePref('dailyReminderTime', e.target.value)}
            className="px-3 py-1.5 rounded-lg font-body text-sm text-text-primary border border-white/10 focus:border-primary outline-none"
            style={{ backgroundColor: '#0F0F1A', colorScheme: 'dark' }}
          />
        </div>
      </NotifRow>

      <NotifRow
        icon="📊"
        title="Weekly AI Summary"
        description="AI analysis of your spending every Monday"
        enabled={prefs.weeklySummary}
        onChange={(v) => updatePref('weeklySummary', v)}
        disabled={allDisabled}
      />

      <NotifRow
        icon="📈"
        title="Monthly Report"
        description="Detailed financial report on the 1st"
        enabled={prefs.monthlyReport}
        onChange={(v) => updatePref('monthlyReport', v)}
        disabled={allDisabled}
      />

      <NotifRow
        icon="⚠️"
        title="Budget Limit Warnings"
        description="Alert when you approach a category budget"
        enabled={prefs.budgetWarnings}
        onChange={(v) => updatePref('budgetWarnings', v)}
        disabled={allDisabled}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-body text-xs text-text-secondary">Alert threshold</span>
            <span className="font-mono text-xs text-text-primary">{prefs.budgetThreshold}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="90"
            step="5"
            value={prefs.budgetThreshold}
            onChange={(e) => updatePref('budgetThreshold', parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #4F46E5 ${((prefs.budgetThreshold - 50) / 40) * 100}%, #2A2A44 ${((prefs.budgetThreshold - 50) / 40) * 100}%)`,
            }}
          />
          <div className="flex justify-between font-body text-[10px] text-text-secondary">
            <span>50%</span>
            <span>75%</span>
            <span>90%</span>
          </div>
        </div>
      </NotifRow>

      <NotifRow
        icon="🚨"
        title="Anomaly Alerts"
        description="Flag spending over 2× your daily average"
        enabled={prefs.anomalyAlerts}
        onChange={(v) => updatePref('anomalyAlerts', v)}
        disabled={allDisabled}
      />

      <NotifRow
        icon="🔔"
        title="Bill Reminders"
        description="Upcoming recurring payments"
        enabled={prefs.billReminders}
        onChange={(v) => updatePref('billReminders', v)}
        disabled={allDisabled}
      />
    </motion.div>
  );
}
