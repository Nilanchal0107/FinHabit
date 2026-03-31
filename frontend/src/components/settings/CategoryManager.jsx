/**
 * CategoryManager.jsx — Manage expense categories.
 * Reads/writes to Firestore: users/{uid}/categories
 * Supports add, edit, delete, and drag-to-reorder via Framer Motion.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { useUIStore } from '@store/uiStore.js';
import { DEFAULT_CATEGORIES } from '@utils/categories.js';

// ── Emoji picker (compact) ────────────────────────────────────────────────────

const EMOJI_OPTIONS = [
  '🍽️', '🚗', '🛍️', '💡', '🏥', '🎬', '📚', '✈️', '🛒', '🏠',
  '🏦', '📈', '🛡️', '📱', '⛽', '💰', '🔄', '🏧', '📶', '📦',
  '🎮', '💊', '🎵', '🍕', '☕', '🐾', '👶', '💇', '🏋️', '🎁',
  '💎', '🚕', '🧹', '📸', '🎯', '🌱', '🍷', '🎠', '🧳', '🛠️',
];

const COLOR_OPTIONS = [
  '#F59E0B', '#4F46E5', '#7C3AED', '#0D9488', '#22C55E', '#F43F5E',
  '#3B82F6', '#8B5CF6', '#84CC16', '#06B6D4', '#EF4444', '#10B981',
  '#64748B', '#EC4899', '#F97316', '#6B7280', '#14B8A6', '#A855F7',
  '#E11D48', '#0EA5E9',
];

// ── Category Item (draggable) ─────────────────────────────────────────────────

function CategoryItem({ category, txnCount, onEdit, onDelete }) {
  return (
    <Reorder.Item
      value={category}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 cursor-grab active:cursor-grabbing group"
      style={{ backgroundColor: '#16162A' }}
      whileDrag={{ scale: 1.03, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}
    >
      {/* Drag handle */}
      <div className="text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
        </svg>
      </div>

      {/* Icon + color dot */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
        style={{ backgroundColor: category.color + '20' }}
      >
        {category.icon}
      </div>

      {/* Name + count */}
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm font-medium text-text-primary truncate">{category.name}</p>
        <p className="font-body text-xs text-text-secondary">
          {txnCount} transaction{txnCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onEdit(category)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
          aria-label={`Edit ${category.name}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        {!category.isDefault && (
          <button
            onClick={() => onDelete(category)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-coral transition-colors"
            aria-label={`Delete ${category.name}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>
    </Reorder.Item>
  );
}

// ── Bottom Sheet (add/edit) ───────────────────────────────────────────────────

function CategorySheet({ isOpen, category, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [color, setColor] = useState('#4F46E5');

  useEffect(() => {
    if (category) {
      setName(category.name);
      setIcon(category.icon);
      setColor(category.color);
    } else {
      setName('');
      setIcon('📦');
      setColor('#4F46E5');
    }
  }, [category, isOpen]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), icon, color });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-white/10 p-6 space-y-5"
            style={{ backgroundColor: '#16162A', maxHeight: '80vh' }}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />

            <h3 className="font-heading text-lg font-bold text-text-primary">
              {category ? 'Edit Category' : 'New Category'}
            </h3>

            {/* Name input */}
            <div className="space-y-1.5">
              <label className="block font-body text-sm text-text-secondary">Category Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 30))}
                placeholder="e.g., Pets, Gym"
                className="w-full px-4 py-3 rounded-xl font-body text-sm text-text-primary border border-white/10 focus:border-primary outline-none transition-colors"
                style={{ backgroundColor: '#0F0F1A' }}
                autoFocus
                id="category-name-input"
              />
            </div>

            {/* Emoji picker */}
            <div className="space-y-1.5">
              <label className="block font-body text-sm text-text-secondary">Icon</label>
              <div className="grid grid-cols-10 gap-1.5 max-h-32 overflow-y-auto">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setIcon(e)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                      icon === e ? 'ring-2 ring-primary' : 'hover:bg-white/5'
                    }`}
                    style={icon === e ? { backgroundColor: 'rgba(79,70,229,0.2)' } : {}}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <label className="block font-body text-sm text-text-secondary">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#16162A] scale-110' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-2xl font-body font-semibold text-text-secondary border border-white/10 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={!name.trim()}
                className="flex-1 py-3 rounded-2xl font-body font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
                id="category-save-btn"
              >
                {category ? 'Update' : 'Add Category'}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────

function DeleteConfirm({ isOpen, category, txnCount, onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-white/10 p-6 space-y-4"
              style={{ backgroundColor: '#16162A' }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto" style={{ backgroundColor: 'rgba(244,63,94,0.15)' }}>
                <span className="text-2xl">🗑️</span>
              </div>
              <h3 className="font-heading text-base font-bold text-text-primary text-center">
                Delete "{category?.name}"?
              </h3>
              <p className="font-body text-sm text-text-secondary text-center">
                {txnCount > 0
                  ? `${txnCount} transaction${txnCount !== 1 ? 's' : ''} will be moved to "Other".`
                  : 'This category has no transactions.'}
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 rounded-2xl font-body font-semibold text-text-secondary border border-white/10 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onConfirm}
                  className="flex-1 py-3 rounded-2xl font-body font-semibold text-white"
                  style={{ backgroundColor: '#F43F5E' }}
                >
                  Delete
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CategoryManager() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();

  const [categories, setCategories] = useState([]);
  const [txnCounts, setTxnCounts] = useState({});
  const [loading, setLoading] = useState(true);

  // Sheets
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Fetch categories + transaction counts ───────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!user?.uid) return;
    try {
      // Fetch custom categories from Firestore
      const catSnap = await getDocs(collection(db, 'users', user.uid, 'categories'));
      const firestoreCats = [];
      catSnap.forEach((d) => firestoreCats.push({ id: d.id, ...d.data() }));

      // Merge: defaults first (unless overridden), then custom
      const mergedMap = new Map();
      DEFAULT_CATEGORIES.forEach((cat) => mergedMap.set(cat.id, { ...cat }));
      firestoreCats.forEach((cat) => mergedMap.set(cat.id, { ...cat }));

      const merged = Array.from(mergedMap.values()).sort(
        (a, b) => (a.order ?? 999) - (b.order ?? 999)
      );
      setCategories(merged);

      // Count transactions per category
      const txnSnap = await getDocs(collection(db, 'users', user.uid, 'transactions'));
      const counts = {};
      txnSnap.forEach((d) => {
        const cat = d.data().category || 'Other';
        counts[cat] = (counts[cat] || 0) + 1;
      });
      setTxnCounts(counts);
    } catch (err) {
      console.error('[CategoryManager] Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Reorder handler ─────────────────────────────────────────────────────────

  const handleReorder = async (newOrder) => {
    setCategories(newOrder);

    // Persist new order
    if (!user?.uid) return;
    try {
      const batch = writeBatch(db);
      newOrder.forEach((cat, idx) => {
        const ref = doc(db, 'users', user.uid, 'categories', cat.id);
        batch.set(ref, { ...cat, order: idx + 1 }, { merge: true });
      });
      await batch.commit();
    } catch (err) {
      console.error('[CategoryManager] Reorder save error:', err.message);
    }
  };

  // ── Add/Edit handler ────────────────────────────────────────────────────────

  const handleSave = async ({ name, icon, color }) => {
    if (!user?.uid) return;

    try {
      const id = editingCategory?.id || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const catData = {
        name,
        icon,
        color,
        isDefault: editingCategory?.isDefault || false,
        order: editingCategory?.order || categories.length + 1,
      };

      await setDoc(doc(db, 'users', user.uid, 'categories', id), catData, { merge: true });

      addToast({
        type: 'success',
        title: editingCategory ? 'Category updated' : 'Category added',
        message: `${icon} ${name}`,
      });

      setSheetOpen(false);
      setEditingCategory(null);
      await fetchData();
    } catch (err) {
      addToast({ type: 'error', title: 'Save failed', message: err.message });
    }
  };

  // ── Delete handler ──────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!user?.uid || !deleteTarget) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'categories', deleteTarget.id));
      addToast({ type: 'success', title: 'Category deleted', message: `"${deleteTarget.name}" removed` });
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      addToast({ type: 'error', title: 'Delete failed', message: err.message });
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 rounded-xl" style={{ backgroundColor: '#1E1E36' }} />
        ))}
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-body text-sm text-text-secondary">
          Drag to reorder • {categories.length} categories
        </p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => { setEditingCategory(null); setSheetOpen(true); }}
          className="px-4 py-2 rounded-xl font-body text-sm font-medium text-white border border-white/10 hover:border-primary/50 transition-colors"
          style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
          id="add-category-btn"
        >
          + Add Category
        </motion.button>
      </div>

      {/* Draggable list */}
      <Reorder.Group
        axis="y"
        values={categories}
        onReorder={handleReorder}
        className="space-y-2"
      >
        {categories.map((cat) => (
          <CategoryItem
            key={cat.id}
            category={cat}
            txnCount={txnCounts[cat.name] || 0}
            onEdit={(c) => { setEditingCategory(c); setSheetOpen(true); }}
            onDelete={(c) => setDeleteTarget(c)}
          />
        ))}
      </Reorder.Group>

      {/* Add/edit bottom sheet */}
      <CategorySheet
        isOpen={sheetOpen}
        category={editingCategory}
        onSave={handleSave}
        onCancel={() => { setSheetOpen(false); setEditingCategory(null); }}
      />

      {/* Delete confirmation */}
      <DeleteConfirm
        isOpen={!!deleteTarget}
        category={deleteTarget}
        txnCount={txnCounts[deleteTarget?.name] || 0}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </motion.div>
  );
}
