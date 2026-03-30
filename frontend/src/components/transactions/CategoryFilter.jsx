/**
 * CategoryFilter.jsx
 * Horizontally-scrollable multi-select category chips + date range presets.
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_CATEGORIES } from '@utils/categories.js';

// ── date preset helpers ───────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split('T')[0]; }

function presetRange(id) {
  const now = new Date();
  switch (id) {
    case 'week': {
      const s = new Date(now); s.setDate(s.getDate() - 6);
      return { start: s.toISOString().split('T')[0], end: todayStr() };
    }
    case 'month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] };
    }
    case 'last-month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] };
    }
    default: return null;
  }
}

const DATE_PRESETS = [
  { id: 'week',       label: 'This week' },
  { id: 'month',      label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'custom',     label: '📅 Custom' },
];

// ── component ─────────────────────────────────────────────────────────────────

export default function CategoryFilter({
  selectedCategories,
  onCategoriesChange,
  dateRange,
  onDateRangeChange,
}) {
  const [activePreset, setActivePreset]   = useState(null);
  const [showCustom,   setShowCustom]     = useState(false);
  const [customStart,  setCustomStart]    = useState('');
  const [customEnd,    setCustomEnd]      = useState('');
  const chipRowRef = useRef(null);

  const isDirty = selectedCategories.length > 0 || activePreset;

  // ── category toggle ──────────────────────────────────────────────────────────

  const toggleCategory = (name) => {
    onCategoriesChange(
      selectedCategories.includes(name)
        ? selectedCategories.filter((c) => c !== name)
        : [...selectedCategories, name]
    );
  };

  // ── date preset toggle ───────────────────────────────────────────────────────

  const handlePreset = (id) => {
    if (id === 'custom') {
      setShowCustom(true);
      setActivePreset('custom');
      return;
    }
    setShowCustom(false);
    if (activePreset === id) {
      setActivePreset(null);
      onDateRangeChange(null);
    } else {
      setActivePreset(id);
      onDateRangeChange(presetRange(id));
    }
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    onDateRangeChange({ start: customStart, end: customEnd });
  };

  const clearAll = () => {
    onCategoriesChange([]);
    onDateRangeChange(null);
    setActivePreset(null);
    setShowCustom(false);
    setCustomStart('');
    setCustomEnd('');
  };

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2.5">

      {/* ── Category chips ──────────────────────────────────────────────────── */}
      <div
        ref={chipRowRef}
        className="flex items-center gap-1.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {/* "All" chip */}
        <button
          onClick={() => onCategoriesChange([])}
          className="flex-shrink-0 px-3 py-1.5 rounded-full font-body text-xs font-medium transition-all"
          style={{
            backgroundColor: selectedCategories.length === 0 ? '#4F46E5' : 'rgba(255,255,255,0.06)',
            color: selectedCategories.length === 0 ? '#fff' : '#8B8A9E',
          }}
        >
          All
        </button>

        {DEFAULT_CATEGORIES.map((cat) => {
          const active = selectedCategories.includes(cat.name);
          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.name)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full font-body text-xs font-medium transition-all"
              style={{
                backgroundColor: active ? `${cat.color}22` : 'rgba(255,255,255,0.05)',
                color:           active ? cat.color : '#8B8A9E',
                border:          `1px solid ${active ? `${cat.color}55` : 'transparent'}`,
              }}
            >
              <span>{cat.icon}</span>
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* ── Date preset pills + clear ────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {DATE_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePreset(p.id)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full font-body text-xs font-medium transition-all border"
            style={{
              backgroundColor: activePreset === p.id ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.05)',
              color:           activePreset === p.id ? '#A78BFA' : '#8B8A9E',
              borderColor:     activePreset === p.id ? 'rgba(124,58,237,0.4)' : 'transparent',
            }}
          >
            {p.label}
          </button>
        ))}

        {isDirty && (
          <button
            onClick={clearAll}
            className="flex-shrink-0 px-3 py-1.5 rounded-full font-body text-xs font-medium transition-all border"
            style={{ backgroundColor: 'rgba(244,63,94,0.1)', color: '#F43F5E', borderColor: 'rgba(244,63,94,0.25)' }}
          >
            Clear ✕
          </button>
        )}
      </div>

      {/* ── Custom date range picker ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-end gap-2 pt-1">
              <div className="flex-1">
                <label className="block font-body text-[10px] text-text-secondary mb-1">From</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl font-body text-xs text-text-primary border border-white/10 outline-none"
                  style={{ backgroundColor: '#0F0F1A', colorScheme: 'dark' }}
                />
              </div>
              <div className="flex-1">
                <label className="block font-body text-[10px] text-text-secondary mb-1">To</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl font-body text-xs text-text-primary border border-white/10 outline-none"
                  style={{ backgroundColor: '#0F0F1A', colorScheme: 'dark' }}
                />
              </div>
              <button
                onClick={applyCustom}
                disabled={!customStart || !customEnd}
                className="px-4 py-2 rounded-xl font-body text-xs font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
              >
                Apply
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
