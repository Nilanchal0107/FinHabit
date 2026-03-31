/**
 * AppPreferences.jsx — App-level preferences.
 * - Language (placeholder for i18n — English only for now)
 * - Theme toggle (Light / Dark / System via Tailwind dark mode)
 * - Week start day (Monday / Sunday)
 * - Currency display format
 *
 * Saves to Firestore: users/{uid}/profile/data → preferences
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { useUIStore } from '@store/uiStore.js';

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_PREFERENCES = {
  language: 'en',
  theme: 'dark',
  weekStartsOn: 'monday',
  currencyFormat: 'en-IN',
};

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ் (Tamil)', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు (Telugu)', flag: '🇮🇳' },
  { code: 'bn', label: 'বাংলা (Bengali)', flag: '🇮🇳' },
  { code: 'mr', label: 'मराठी (Marathi)', flag: '🇮🇳' },
];

const THEMES = [
  { id: 'dark', label: 'Dark', icon: '🌙' },
  { id: 'light', label: 'Light', icon: '☀️' },
  { id: 'system', label: 'System', icon: '💻' },
];

// ── Option Card ───────────────────────────────────────────────────────────────

function OptionGroup({ title, description, children }) {
  return (
    <div
      className="rounded-xl border border-white/5 overflow-hidden"
      style={{ backgroundColor: '#16162A' }}
    >
      <div className="px-4 py-3 border-b border-white/5">
        <p className="font-body text-sm font-medium text-text-primary">{title}</p>
        {description && (
          <p className="font-body text-xs text-text-secondary mt-0.5">{description}</p>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AppPreferences() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();

  const [prefs, setPrefs] = useState(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Fetch preferences ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'profile', 'data'));
        if (snap.exists() && snap.data().preferences) {
          setPrefs({ ...DEFAULT_PREFERENCES, ...snap.data().preferences });
        }
      } catch (err) {
        console.error('[AppPreferences] Fetch error:', err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ── Save a preference ──────────────────────────────────────────────────────

  const updatePref = async (key, value) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);

    if (!user?.uid) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'profile', 'data'),
        { preferences: newPrefs },
        { merge: true }
      );
    } catch (err) {
      addToast({ type: 'error', title: 'Save failed', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Currency preview ────────────────────────────────────────────────────────

  const formatExample = new Intl.NumberFormat(prefs.currencyFormat, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(123456.78);

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl" style={{ backgroundColor: '#1E1E36' }} />
        ))}
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Saving indicator */}
      {saving && (
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="font-body text-xs text-text-secondary">Saving…</span>
        </div>
      )}

      {/* ── Language ──────────────────────────────────────────────────── */}
      <OptionGroup title="Language" description="Select your preferred language">
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((lang) => (
            <motion.button
              key={lang.code}
              whileTap={{ scale: 0.97 }}
              onClick={() => updatePref('language', lang.code)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl font-body text-sm border transition-all ${
                prefs.language === lang.code
                  ? 'border-primary text-text-primary'
                  : 'border-white/10 text-text-secondary hover:border-white/20'
              }`}
              style={
                prefs.language === lang.code
                  ? { backgroundColor: 'rgba(79,70,229,0.15)' }
                  : { backgroundColor: '#0F0F1A' }
              }
            >
              <span>{lang.flag}</span>
              <span className="truncate">{lang.label}</span>
            </motion.button>
          ))}
        </div>
        {prefs.language !== 'en' && (
          <p className="font-body text-xs text-amber mt-3">
            ⚠️ Only English is available right now. Other languages are coming soon.
          </p>
        )}
      </OptionGroup>

      {/* ── Theme ─────────────────────────────────────────────────────── */}
      <OptionGroup title="Theme" description="Choose your visual preference">
        <div className="flex gap-2">
          {THEMES.map((theme) => (
            <motion.button
              key={theme.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => updatePref('theme', theme.id)}
              className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl font-body text-sm border transition-all ${
                prefs.theme === theme.id
                  ? 'border-primary text-text-primary'
                  : 'border-white/10 text-text-secondary hover:border-white/20'
              }`}
              style={
                prefs.theme === theme.id
                  ? { backgroundColor: 'rgba(79,70,229,0.15)' }
                  : { backgroundColor: '#0F0F1A' }
              }
            >
              <span className="text-2xl">{theme.icon}</span>
              <span className="font-medium">{theme.label}</span>
            </motion.button>
          ))}
        </div>
        {prefs.theme !== 'dark' && (
          <p className="font-body text-xs text-amber mt-3">
            ⚠️ Only Dark theme is available right now. Light theme is coming soon.
          </p>
        )}
      </OptionGroup>

      {/* ── Week starts on ────────────────────────────────────────────── */}
      <OptionGroup title="Week Starts On" description="For calendar and weekly reports">
        <div className="flex gap-2">
          {[
            { id: 'monday', label: 'Monday' },
            { id: 'sunday', label: 'Sunday' },
          ].map((opt) => (
            <motion.button
              key={opt.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => updatePref('weekStartsOn', opt.id)}
              className={`flex-1 py-3 rounded-xl font-body text-sm border transition-all ${
                prefs.weekStartsOn === opt.id
                  ? 'border-primary text-text-primary font-medium'
                  : 'border-white/10 text-text-secondary hover:border-white/20'
              }`}
              style={
                prefs.weekStartsOn === opt.id
                  ? { backgroundColor: 'rgba(79,70,229,0.15)' }
                  : { backgroundColor: '#0F0F1A' }
              }
            >
              {opt.label}
            </motion.button>
          ))}
        </div>
      </OptionGroup>

      {/* ── Currency Format ───────────────────────────────────────────── */}
      <OptionGroup title="Currency Display" description="How amounts are formatted">
        <div
          className="px-4 py-3 rounded-xl border border-white/5 text-center"
          style={{ backgroundColor: '#0F0F1A' }}
        >
          <p className="font-mono text-lg text-text-primary">{formatExample}</p>
          <p className="font-body text-xs text-text-secondary mt-1">Indian numbering system (₹ 1,23,456.78)</p>
        </div>
      </OptionGroup>

      {/* ── App Version ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-center py-4">
        <p className="font-body text-xs text-text-secondary">
          FinHabits v1.0.0 • Made with 💜 in India
        </p>
      </div>
    </motion.div>
  );
}
