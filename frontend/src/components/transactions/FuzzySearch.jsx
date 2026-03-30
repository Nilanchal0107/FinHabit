/**
 * FuzzySearch.jsx
 * Fuse.js-powered search bar with 300ms debounce + localStorage history.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import { AnimatePresence, motion } from 'framer-motion';

const HISTORY_KEY = 'finhabits_search_history';
const MAX_HISTORY = 5;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(term) {
  const next = [term, ...loadHistory().filter((h) => h !== term)].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

const FUSE_OPTS = {
  keys: [
    { name: 'merchant', weight: 0.45 },
    { name: 'category', weight: 0.2 },
    { name: 'notes',    weight: 0.2 },
    { name: 'amount',   getFn: (t) => String(t.amount), weight: 0.15 },
  ],
  threshold:        0.35,
  minMatchCharLength: 2,
};

export default function FuzzySearch({ transactions, onResults }) {
  const [query, setQuery]     = useState('');
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  const fuseRef   = useRef(null);
  const timerRef  = useRef(null);

  // Rebuild index whenever transaction list changes
  useEffect(() => {
    fuseRef.current = new Fuse(transactions, FUSE_OPTS);
  }, [transactions]);

  const runSearch = useCallback((q) => {
    if (!q.trim()) { onResults(null); return; }
    const results = fuseRef.current?.search(q).map((r) => r.item) ?? [];
    onResults(results);
    if (q.trim().length >= 2) {
      saveHistory(q.trim());
      setHistory(loadHistory());
    }
  }, [onResults]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSearch(val), 300);
  };

  const handleClear = () => {
    setQuery('');
    onResults(null);
  };

  const applyHistory = (term) => {
    setQuery(term);
    runSearch(term);
    setFocused(false);
  };

  const showHistory = focused && !query && history.length > 0;

  return (
    <div className="relative z-20">
      {/* Input */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base pointer-events-none select-none">🔍</span>
        <input
          id="search-transactions"
          type="search"
          autoComplete="off"
          value={query}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search by merchant, category, amount…"
          className="w-full pl-10 pr-9 py-3 rounded-2xl font-body text-sm text-text-primary placeholder:text-text-secondary border border-white/8 focus:border-primary/60 outline-none transition-colors"
          style={{ backgroundColor: '#16162A' }}
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Recent search history dropdown */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1.5 rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
            style={{ backgroundColor: '#1E1E35' }}
          >
            <p className="px-4 pt-3 pb-1 font-body text-[10px] text-text-secondary uppercase tracking-widest">
              Recent searches
            </p>
            {history.map((item, i) => (
              <button
                key={i}
                onClick={() => applyHistory(item)}
                className="w-full text-left px-4 py-2.5 font-body text-sm text-text-primary hover:bg-white/5 transition-colors flex items-center gap-2.5"
              >
                <span className="text-text-secondary text-sm">🕐</span>
                {item}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
