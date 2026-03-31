/**
 * ProfileSection.jsx — User profile editor.
 * Reads/writes directly to Firestore: users/{uid}/profile/data
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { useUIStore } from '@store/uiStore.js';

// ── Indian states & cities ────────────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Chandigarh', 'Puducherry',
];

const MAJOR_CITIES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Ahmedabad', 'Chennai',
  'Kolkata', 'Pune', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore',
  'Thane', 'Bhopal', 'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad',
  'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot',
  'Varanasi', 'Srinagar', 'Coimbatore', 'Kochi', 'Chandigarh',
  'Guwahati', 'Bhubaneswar', 'Mysuru', 'Noida', 'Gurugram', 'Other',
];

const EMPLOYMENT_TYPES = ['Salaried', 'Freelancer', 'Business', 'Student'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfileSection() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    city: '',
    state: '',
    employmentType: 'Salaried',
  });

  // Fetch profile on mount
  useEffect(() => {
    if (!user?.uid) return;

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'profile', 'data'));
        if (snap.exists()) {
          const d = snap.data();
          setForm({
            name: d.name || user.displayName || '',
            phone: d.phone || user.phoneNumber || '',
            city: d.city || '',
            state: d.state || '',
            employmentType: d.employmentType || 'Salaried',
          });
        } else {
          setForm((f) => ({
            ...f,
            name: user.displayName || '',
            phone: user.phoneNumber || '',
          }));
        }
      } catch (err) {
        console.error('[ProfileSection] Fetch error:', err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    if (!user?.uid || !form.name.trim()) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'profile', 'data'),
        {
          name: form.name.trim(),
          phone: form.phone.trim(),
          city: form.city,
          state: form.state,
          employmentType: form.employmentType,
          email: user.email || '',
          updatedAt: new Date(),
        },
        { merge: true }
      );
      addToast({ type: 'success', title: 'Profile saved', message: 'Your changes have been saved.' });
    } catch (err) {
      addToast({ type: 'error', title: 'Save failed', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Avatar ──────────────────────────────────────────────────────────────────

  const initials = (form.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const inputClass =
    'w-full px-4 py-3 rounded-xl font-body text-sm text-text-primary placeholder:text-text-secondary border border-white/10 focus:border-primary outline-none transition-colors';
  const inputStyle = { backgroundColor: '#0F0F1A' };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full" style={{ backgroundColor: '#1E1E36' }} />
          <div className="flex-1 space-y-2">
            <div className="h-5 rounded-lg w-32" style={{ backgroundColor: '#1E1E36' }} />
            <div className="h-4 rounded-lg w-48" style={{ backgroundColor: '#1E1E36' }} />
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-xl" style={{ backgroundColor: '#1E1E36' }} />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Avatar + email */}
      <div className="flex items-center gap-4">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={form.name || 'User'}
            className="w-16 h-16 rounded-full border-2 border-white/10 object-cover"
          />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center font-heading text-lg font-bold text-white border-2 border-white/10"
            style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
          >
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-heading text-base font-bold text-text-primary truncate">
            {form.name || 'Your Name'}
          </p>
          <p className="font-body text-sm text-text-secondary truncate">
            {user?.email || 'No email'}
          </p>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <label className="block font-body text-sm text-text-secondary">Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Your full name"
          className={inputClass}
          style={inputStyle}
          id="settings-name"
        />
      </div>

      {/* Email (read-only) */}
      <div className="space-y-1.5">
        <label className="block font-body text-sm text-text-secondary">Email</label>
        <input
          type="email"
          value={user?.email || ''}
          readOnly
          className={inputClass + ' opacity-60 cursor-not-allowed'}
          style={inputStyle}
          id="settings-email"
        />
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <label className="block font-body text-sm text-text-secondary">Phone</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => update({ phone: e.target.value })}
          placeholder="+91 98765 43210"
          className={inputClass}
          style={inputStyle}
          id="settings-phone"
        />
      </div>

      {/* City + State */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block font-body text-sm text-text-secondary">City</label>
          <select
            value={form.city}
            onChange={(e) => update({ city: e.target.value })}
            className={inputClass + ' appearance-none'}
            style={{ ...inputStyle, colorScheme: 'dark' }}
            id="settings-city"
          >
            <option value="">Select city</option>
            {MAJOR_CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block font-body text-sm text-text-secondary">State</label>
          <select
            value={form.state}
            onChange={(e) => update({ state: e.target.value })}
            className={inputClass + ' appearance-none'}
            style={{ ...inputStyle, colorScheme: 'dark' }}
            id="settings-state"
          >
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employment type pills */}
      <div className="space-y-1.5">
        <label className="block font-body text-sm text-text-secondary">Employment Type</label>
        <div className="flex flex-wrap gap-2">
          {EMPLOYMENT_TYPES.map((type) => (
            <motion.button
              key={type}
              whileTap={{ scale: 0.95 }}
              onClick={() => update({ employmentType: type })}
              className={`px-4 py-2 rounded-full font-body text-sm border transition-all duration-200 ${
                form.employmentType === type
                  ? 'border-primary text-white'
                  : 'border-white/10 text-text-secondary hover:border-white/20'
              }`}
              style={
                form.employmentType === type
                  ? { backgroundColor: 'rgba(79,70,229,0.25)' }
                  : { backgroundColor: '#0F0F1A' }
              }
            >
              {type}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Save */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        disabled={saving || !form.name.trim()}
        className="w-full py-3.5 rounded-2xl font-body font-semibold text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
        id="settings-save-profile"
      >
        {saving ? (
          <span className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
        ) : (
          'Save Changes'
        )}
      </motion.button>
    </motion.div>
  );
}
