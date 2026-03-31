/**
 * DataExport.jsx — Data export, privacy controls, and account deletion.
 * - CSV/JSON export using PapaParse (client-side, no backend)
 * - View stored data
 * - Delete all transactions
 * - Delete entire account (Firestore + Auth)
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  collection, getDocs, deleteDoc, doc, writeBatch,
} from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import Papa from 'papaparse';
import { db, auth } from '@services/firebase.js';
import { fetchAllTransactions } from '@services/api.js';
import { useAuthStore } from '@store/authStore.js';
import { useUIStore } from '@store/uiStore.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDateForExport(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return '';
  }
}

// ── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({ icon, title, description, children }) {
  return (
    <div
      className="rounded-xl border border-white/5 overflow-hidden"
      style={{ backgroundColor: '#16162A' }}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <span className="text-lg">{icon}</span>
        <div>
          <p className="font-body text-sm font-medium text-text-primary">{title}</p>
          <p className="font-body text-xs text-text-secondary">{description}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DataExport() {
  const { user } = useAuthStore();
  const { addToast, clearChatHistory } = useUIStore();
  const { clearUser } = useAuthStore();
  const navigate = useNavigate();

  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [showStoredData, setShowStoredData] = useState(false);
  const [storedCollections, setStoredCollections] = useState(null);
  const [showDeleteTxns, setShowDeleteTxns] = useState(false);
  const [deletingTxns, setDeletingTxns] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // ── Fetch transactions for export (via backend API — returns decrypted amounts) ─

  const fetchTransactionsForExport = useCallback(async () => {
    if (!user?.uid) return [];

    // Use the backend endpoint which decrypts amounts and resolves dates
    const { transactions } = await fetchAllTransactions();

    // Apply client-side date range filter
    const filtered = transactions.filter((txn) => {
      if (!txn.date) return true;
      const txnDate = new Date(txn.date);
      if (dateRange.from && txnDate < new Date(dateRange.from)) return false;
      if (dateRange.to && txnDate > new Date(dateRange.to + 'T23:59:59')) return false;
      return true;
    });

    // Map to export-friendly format with readable dates and plain amounts
    return filtered.map((txn) => ({
      Date: formatDateForExport(txn.date),
      Merchant: txn.merchant || '',
      Category: txn.category || '',
      Amount: txn.amount || 0,
      Type: txn.transactionType || '',
      PaymentMethod: txn.paymentMethod || '',
      Notes: txn.notes || '',
    }));
  }, [user, dateRange]);

  // ── Export CSV ──────────────────────────────────────────────────────────────

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const txns = await fetchTransactionsForExport();
      if (txns.length === 0) {
        addToast({ type: 'info', title: 'No data', message: 'No transactions found for this period.' });
        return;
      }
      const csv = Papa.unparse(txns);
      const filename = `finhabits_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      addToast({ type: 'success', title: 'CSV exported', message: `${txns.length} transactions downloaded` });
    } catch (err) {
      addToast({ type: 'error', title: 'Export failed', message: err.message });
    } finally {
      setExporting(false);
    }
  };

  // ── Export JSON ─────────────────────────────────────────────────────────────

  const handleExportJSON = async () => {
    setExporting(true);
    try {
      const txns = await fetchTransactionsForExport();
      if (txns.length === 0) {
        addToast({ type: 'info', title: 'No data', message: 'No transactions found for this period.' });
        return;
      }
      const json = JSON.stringify(txns, null, 2);
      const filename = `finhabits_transactions_${new Date().toISOString().slice(0, 10)}.json`;
      downloadFile(json, filename, 'application/json');
      addToast({ type: 'success', title: 'JSON exported', message: `${txns.length} transactions downloaded` });
    } catch (err) {
      addToast({ type: 'error', title: 'Export failed', message: err.message });
    } finally {
      setExporting(false);
    }
  };

  // ── View stored data ────────────────────────────────────────────────────────

  const handleViewData = async () => {
    if (storedCollections) {
      setShowStoredData(!showStoredData);
      return;
    }
    if (!user?.uid) return;

    try {
      const collections = {};
      const subcollections = ['profile', 'transactions', 'categories', 'budgets', 'patterns', 'insights'];

      for (const col of subcollections) {
        if (col === 'profile') {
          const snap = await getDocs(collection(db, 'users', user.uid, col));
          collections[col] = snap.size;
        } else {
          const snap = await getDocs(collection(db, 'users', user.uid, col));
          collections[col] = snap.size;
        }
      }

      setStoredCollections(collections);
      setShowStoredData(true);
    } catch (err) {
      addToast({ type: 'error', title: 'Fetch failed', message: err.message });
    }
  };

  // ── Delete all transactions ─────────────────────────────────────────────────

  const handleDeleteTransactions = async () => {
    if (!user?.uid) return;
    setDeletingTxns(true);
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'transactions'));
      const batchSize = 500;
      let batch = writeBatch(db);
      let count = 0;

      for (const d of snap.docs) {
        batch.delete(d.ref);
        count++;
        if (count % batchSize === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }
      if (count % batchSize !== 0) {
        await batch.commit();
      }

      addToast({ type: 'success', title: 'Transactions deleted', message: `${count} transactions removed` });
      setShowDeleteTxns(false);
    } catch (err) {
      addToast({ type: 'error', title: 'Delete failed', message: err.message });
    } finally {
      setDeletingTxns(false);
    }
  };

  // ── Delete account ──────────────────────────────────────────────────────────

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE' || !user?.uid) return;
    setDeletingAccount(true);

    try {
      // 1. Delete all Firestore sub-collections
      const subcollections = ['profile', 'transactions', 'categories', 'budgets', 'patterns', 'insights'];

      for (const col of subcollections) {
        const snap = await getDocs(collection(db, 'users', user.uid, col));
        const batch = writeBatch(db);
        snap.forEach((d) => batch.delete(d.ref));
        if (!snap.empty) await batch.commit();
      }

      // 2. Delete the user doc itself
      await deleteDoc(doc(db, 'users', user.uid));

      // 3. Delete Firebase Auth user
      const currentUser = auth.currentUser;
      if (currentUser) {
        await deleteUser(currentUser);
      }

      // 4. Clear local state
      clearChatHistory();
      clearUser();

      addToast({ type: 'success', title: 'Account deleted', message: 'All your data has been removed.' });

      // 5. Redirect to landing
      navigate('/landing', { replace: true });
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        addToast({
          type: 'error',
          title: 'Re-authentication required',
          message: 'Please sign out, sign in again, and retry account deletion.',
        });
      } else {
        addToast({ type: 'error', title: 'Deletion failed', message: err.message });
      }
    } finally {
      setDeletingAccount(false);
      setShowDeleteAccount(false);
    }
  };

  const inputClass = 'px-3 py-2 rounded-lg font-body text-sm text-text-primary border border-white/10 focus:border-primary outline-none transition-colors';
  const inputStyle = { backgroundColor: '#0F0F1A', colorScheme: 'dark' };
  const btnOutline = 'px-4 py-2.5 rounded-xl font-body text-sm font-medium border border-white/10 hover:border-white/20 text-text-primary transition-colors';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

      {/* ── Export Data ──────────────────────────────────────────────── */}
      <SectionCard icon="📤" title="Export Data" description="Download your transaction history">
        <div className="space-y-4">
          {/* Date range */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <label className="block font-body text-xs text-text-secondary">From</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))}
                className={inputClass + ' w-full'}
                style={inputStyle}
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="block font-body text-xs text-text-secondary">To</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))}
                className={inputClass + ' w-full'}
                style={inputStyle}
              />
            </div>
          </div>
          <p className="font-body text-xs text-text-secondary">
            Leave empty to export all transactions
          </p>

          <div className="flex gap-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleExportCSV}
              disabled={exporting}
              className={btnOutline + ' flex-1 flex items-center justify-center gap-2'}
              id="export-csv-btn"
            >
              {exporting ? (
                <span className="w-4 h-4 rounded-full border-2 border-text-primary border-t-transparent animate-spin" />
              ) : (
                <>📄 Export CSV</>
              )}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleExportJSON}
              disabled={exporting}
              className={btnOutline + ' flex-1 flex items-center justify-center gap-2'}
              id="export-json-btn"
            >
              {exporting ? (
                <span className="w-4 h-4 rounded-full border-2 border-text-primary border-t-transparent animate-spin" />
              ) : (
                <>{ '{}'} Export JSON</>
              )}
            </motion.button>
          </div>
        </div>
      </SectionCard>

      {/* ── View Stored Data ─────────────────────────────────────────── */}
      <SectionCard icon="🗄️" title="Stored Data" description="See what data FinHabits keeps">
        <div className="space-y-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleViewData}
            className={btnOutline + ' w-full'}
          >
            {showStoredData ? 'Hide data summary' : 'View what data is stored'}
          </motion.button>

          <AnimatePresence>
            {showStoredData && storedCollections && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                {Object.entries(storedCollections).map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between px-3 py-2 rounded-lg border border-white/5" style={{ backgroundColor: '#0F0F1A' }}>
                    <span className="font-body text-sm text-text-primary capitalize">{name}</span>
                    <span className="font-mono text-xs text-text-secondary">{count} document{count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SectionCard>

      {/* ── Danger Zone ──────────────────────────────────────────────── */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: 'rgba(244,63,94,0.25)', backgroundColor: 'rgba(244,63,94,0.03)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'rgba(244,63,94,0.15)' }}>
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-body text-sm font-medium text-coral">Danger Zone</p>
            <p className="font-body text-xs text-text-secondary">Irreversible actions</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {/* Delete transactions */}
          <button
            onClick={() => setShowDeleteTxns(true)}
            className="w-full py-3 rounded-xl font-body text-sm font-medium text-coral border border-coral/20 hover:bg-coral/5 transition-colors"
            id="delete-txns-btn"
          >
            🗑️ Delete all transaction history
          </button>

          {/* Delete account */}
          <button
            onClick={() => setShowDeleteAccount(true)}
            className="w-full py-3 rounded-xl font-body text-sm font-medium text-white border border-coral/30 transition-colors"
            style={{ backgroundColor: 'rgba(244,63,94,0.15)' }}
            id="delete-account-btn"
          >
            💀 Delete my account
          </button>
        </div>
      </div>

      {/* ── Delete Transactions Confirmation ──────────────────────── */}
      <AnimatePresence>
        {showDeleteTxns && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteTxns(false)} className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center px-6">
              <div className="w-full max-w-sm rounded-2xl border border-white/10 p-6 space-y-4" style={{ backgroundColor: '#16162A' }}>
                <h3 className="font-heading text-base font-bold text-text-primary text-center">Delete All Transactions?</h3>
                <p className="font-body text-sm text-text-secondary text-center">This cannot be undone. All transaction history will be permanently removed.</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowDeleteTxns(false)} className="flex-1 py-3 rounded-2xl font-body font-semibold text-text-secondary border border-white/10 hover:bg-white/5 transition-colors">Cancel</button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleDeleteTransactions} disabled={deletingTxns} className="flex-1 py-3 rounded-2xl font-body font-semibold text-white flex items-center justify-center" style={{ backgroundColor: '#F43F5E' }}>
                    {deletingTxns ? <span className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : 'Delete All'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Delete Account Confirmation ───────────────────────────── */}
      <AnimatePresence>
        {showDeleteAccount && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowDeleteAccount(false); setDeleteConfirmText(''); }} className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center px-6">
              <div className="w-full max-w-sm rounded-2xl border border-white/10 p-6 space-y-4" style={{ backgroundColor: '#16162A' }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: 'rgba(244,63,94,0.15)' }}>
                  <span className="text-3xl">💀</span>
                </div>
                <h3 className="font-heading text-base font-bold text-text-primary text-center">Delete Account Forever?</h3>
                <p className="font-body text-sm text-text-secondary text-center">
                  This will permanently delete your profile, all transactions, budgets, categories, insights, and AI patterns.
                </p>
                <div className="space-y-2">
                  <label className="block font-body text-xs text-text-secondary">Type <strong className="text-coral">DELETE</strong> to confirm</label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full px-4 py-3 rounded-xl font-body text-sm text-text-primary border focus:outline-none transition-colors"
                    style={{
                      backgroundColor: '#0F0F1A',
                      borderColor: deleteConfirmText === 'DELETE' ? '#F43F5E' : 'rgba(255,255,255,0.1)',
                    }}
                    id="delete-account-confirm-input"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowDeleteAccount(false); setDeleteConfirmText(''); }} className="flex-1 py-3 rounded-2xl font-body font-semibold text-text-secondary border border-white/10 hover:bg-white/5 transition-colors">Cancel</button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'DELETE' || deletingAccount}
                    className="flex-1 py-3 rounded-2xl font-body font-semibold text-white flex items-center justify-center disabled:opacity-40"
                    style={{ backgroundColor: '#F43F5E' }}
                  >
                    {deletingAccount ? <span className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : 'Delete Account'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
