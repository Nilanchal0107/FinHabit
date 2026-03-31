/**
 * Settings.jsx — Full settings page with collapsible sections.
 * All data reads from / writes to Firestore directly (no backend needed).
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@store/authStore.js';
import { useUIStore } from '@store/uiStore.js';
import { signOut } from '@services/firebase.js';

import ProfileSection from '@components/settings/ProfileSection.jsx';
import CategoryManager from '@components/settings/CategoryManager.jsx';
import BudgetManager from '@components/settings/BudgetManager.jsx';
import NotificationSettings from '@components/settings/NotificationSettings.jsx';
import DataExport from '@components/settings/DataExport.jsx';
import AppPreferences from '@components/settings/AppPreferences.jsx';

// ── Section config ────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'profile',
    icon: '👤',
    title: 'Profile',
    description: 'Name, email, phone, location',
    color: '#4F46E5',
    Component: ProfileSection,
  },
  {
    id: 'categories',
    icon: '📂',
    title: 'Categories',
    description: 'Manage and reorder your categories',
    color: '#7C3AED',
    Component: CategoryManager,
  },
  {
    id: 'budgets',
    icon: '💰',
    title: 'Budgets',
    description: 'Set monthly limits per category',
    color: '#0D9488',
    Component: BudgetManager,
  },
  {
    id: 'notifications',
    icon: '🔔',
    title: 'Notifications',
    description: 'Alerts, reminders, summaries',
    color: '#F59E0B',
    Component: NotificationSettings,
  },
  {
    id: 'data',
    icon: '🔒',
    title: 'Data & Privacy',
    description: 'Export, delete, manage your data',
    color: '#F43F5E',
    Component: DataExport,
  },
  {
    id: 'preferences',
    icon: '⚙️',
    title: 'App Preferences',
    description: 'Language, theme, currency',
    color: '#3B82F6',
    Component: AppPreferences,
  },
];

// ── Accordion section ─────────────────────────────────────────────────────────

function SettingsAccordion({ section, isOpen, onToggle }) {
  const { id, icon, title, description, color, Component } = section;

  return (
    <motion.div
      layout
      className="rounded-2xl border border-white/5 overflow-hidden"
      style={{ backgroundColor: '#16162A' }}
    >
      {/* Header */}
      <motion.button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left group transition-colors hover:bg-white/[0.02]"
        id={`settings-section-${id}`}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform duration-200 group-hover:scale-105"
          style={{ backgroundColor: color + '18' }}
        >
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-heading text-sm font-bold text-text-primary">{title}</p>
          <p className="font-body text-xs text-text-secondary">{description}</p>
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="shrink-0 text-text-secondary"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.div>
      </motion.button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 border-t border-white/5">
              <Component />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────────────

export default function Settings() {
  const { user } = useAuthStore();
  const { addToast, clearChatHistory } = useUIStore();
  const [openSection, setOpenSection] = useState('profile');

  const handleToggle = (id) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  const handleSignOut = async () => {
    try {
      clearChatHistory();
      await signOut();
      addToast({ type: 'success', title: 'Signed out', message: 'See you soon!' });
    } catch (err) {
      addToast({ type: 'error', title: 'Sign out failed', message: err.message });
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-6">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h1 className="font-heading text-2xl font-bold text-text-primary">Settings</h1>
        <p className="font-body text-sm text-text-secondary">
          Manage your account, categories, budgets, and preferences
        </p>
      </motion.div>

      {/* Sections */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        {SECTIONS.map((section, i) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
          >
            <SettingsAccordion
              section={section}
              isOpen={openSection === section.id}
              onToggle={() => handleToggle(section.id)}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Sign out button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="pt-2"
      >
        <button
          onClick={handleSignOut}
          className="w-full py-3.5 rounded-2xl font-body text-sm font-semibold text-text-secondary border border-white/10 hover:border-white/20 hover:bg-white/[0.02] transition-all duration-200 flex items-center justify-center gap-2"
          id="settings-signout"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </motion.div>

      {/* Version footer */}
      <div className="text-center pb-8">
        <p className="font-body text-xs text-text-secondary">
          Signed in as <span className="text-text-primary">{user?.email || 'Unknown'}</span>
        </p>
      </div>
    </div>
  );
}
