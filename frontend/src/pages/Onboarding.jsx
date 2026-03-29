import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';
import { useUIStore } from '@store/uiStore.js';
import { EXPENSE_CATEGORIES } from '@utils/categories.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

const INDIAN_CITIES = [
  { city: 'Mumbai', state: 'Maharashtra' },
  { city: 'Delhi', state: 'Delhi' },
  { city: 'Bengaluru', state: 'Karnataka' },
  { city: 'Hyderabad', state: 'Telangana' },
  { city: 'Ahmedabad', state: 'Gujarat' },
  { city: 'Chennai', state: 'Tamil Nadu' },
  { city: 'Kolkata', state: 'West Bengal' },
  { city: 'Surat', state: 'Gujarat' },
  { city: 'Pune', state: 'Maharashtra' },
  { city: 'Jaipur', state: 'Rajasthan' },
  { city: 'Lucknow', state: 'Uttar Pradesh' },
  { city: 'Kanpur', state: 'Uttar Pradesh' },
  { city: 'Nagpur', state: 'Maharashtra' },
  { city: 'Indore', state: 'Madhya Pradesh' },
  { city: 'Thane', state: 'Maharashtra' },
  { city: 'Bhopal', state: 'Madhya Pradesh' },
  { city: 'Visakhapatnam', state: 'Andhra Pradesh' },
  { city: 'Patna', state: 'Bihar' },
  { city: 'Vadodara', state: 'Gujarat' },
  { city: 'Ghaziabad', state: 'Uttar Pradesh' },
  { city: 'Ludhiana', state: 'Punjab' },
  { city: 'Agra', state: 'Uttar Pradesh' },
  { city: 'Nashik', state: 'Maharashtra' },
  { city: 'Faridabad', state: 'Haryana' },
  { city: 'Meerut', state: 'Uttar Pradesh' },
  { city: 'Rajkot', state: 'Gujarat' },
  { city: 'Varanasi', state: 'Uttar Pradesh' },
  { city: 'Srinagar', state: 'Jammu & Kashmir' },
  { city: 'Aurangabad', state: 'Maharashtra' },
  { city: 'Dhanbad', state: 'Jharkhand' },
  { city: 'Amritsar', state: 'Punjab' },
  { city: 'Allahabad', state: 'Uttar Pradesh' },
  { city: 'Ranchi', state: 'Jharkhand' },
  { city: 'Howrah', state: 'West Bengal' },
  { city: 'Coimbatore', state: 'Tamil Nadu' },
  { city: 'Vijayawada', state: 'Andhra Pradesh' },
  { city: 'Jodhpur', state: 'Rajasthan' },
  { city: 'Madurai', state: 'Tamil Nadu' },
  { city: 'Raipur', state: 'Chhattisgarh' },
  { city: 'Kota', state: 'Rajasthan' },
  { city: 'Guwahati', state: 'Assam' },
  { city: 'Chandigarh', state: 'Chandigarh' },
  { city: 'Mysuru', state: 'Karnataka' },
  { city: 'Thiruvananthapuram', state: 'Kerala' },
  { city: 'Bhubaneswar', state: 'Odisha' },
  { city: 'Noida', state: 'Uttar Pradesh' },
  { city: 'Gurugram', state: 'Haryana' },
  { city: 'Kochi', state: 'Kerala' },
  { city: 'Dehradun', state: 'Uttarakhand' },
  { city: 'Other', state: '' },
];

const BANKS = ['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'PNB', 'Yes Bank', 'IndusInd', 'Canara', 'Other'];
const UPI_APPS = ['GPay', 'PhonePe', 'Paytm', 'BHIM', 'Amazon Pay', 'Other'];
const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Kannada'];
const EMPLOYMENT_TYPES = ['Salaried', 'Freelancer', 'Business', 'Student'];
const SALARY_DATES = Array.from({ length: 31 }, (_, i) => i + 1);

const BUDGET_CATEGORIES = EXPENSE_CATEGORIES.filter((c) =>
  ['food', 'transport', 'shopping', 'utilities', 'entertainment', 'groceries'].includes(c.id)
);

const BUDGET_SUGGESTIONS = { food: 30, transport: 10, shopping: 15, utilities: 8, entertainment: 10, groceries: 20 };

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function StepContainer({ children }) {
  return (
    <motion.div
      key="step"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      {children}
    </motion.div>
  );
}

function StepHeading({ title, subtitle }) {
  return (
    <div>
      <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary">{title}</h2>
      {subtitle && <p className="font-body text-text-secondary mt-2">{subtitle}</p>}
    </div>
  );
}

function Field({ label, children, error }) {
  return (
    <div className="space-y-1.5">
      <label className="block font-body text-sm font-medium text-text-secondary">{label}</label>
      {children}
      {error && <p className="font-body text-xs text-coral">{error}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', prefix, ...rest }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/10 focus-within:border-primary transition-colors"
         style={{ backgroundColor: '#16162A' }}>
      {prefix && <span className="font-body text-text-secondary text-sm flex-shrink-0">{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="flex-1 bg-transparent font-body text-sm text-text-primary placeholder:text-text-secondary outline-none"
        {...rest}
      />
    </div>
  );
}

function PillButton({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl font-body text-sm font-medium border transition-all duration-200
        ${selected
          ? 'border-primary text-white shadow-glow'
          : 'border-white/10 text-text-secondary hover:border-white/25 hover:text-text-primary'
        }`}
      style={selected ? { backgroundColor: 'rgba(79,70,229,0.25)' } : { backgroundColor: '#16162A' }}
    >
      {children}
    </button>
  );
}

function MultiChip({ options, selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(isSelected ? selected.filter((s) => s !== opt) : [...selected, opt])}
            className={`px-3.5 py-2 rounded-xl font-body text-sm border transition-all duration-200
              ${isSelected
                ? 'border-primary text-white'
                : 'border-white/10 text-text-secondary hover:border-white/25'
              }`}
            style={isSelected ? { backgroundColor: 'rgba(79,70,229,0.2)' } : { backgroundColor: '#16162A' }}
          >
            {opt} {isSelected && '✓'}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="font-body text-sm text-text-primary">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-white/10'}`}
        role="switch"
        aria-checked={checked}
      >
        <motion.span
          animate={{ x: checked ? 22 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
        />
      </button>
    </div>
  );
}

function RangeSlider({ value, onChange, min, max, step = 1000, formatLabel }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex justify-between font-mono text-sm">
        <span className="text-text-secondary">{formatLabel(min)}</span>
        <span className="text-text-primary font-semibold">{formatLabel(value)}</span>
        <span className="text-text-secondary">{formatLabel(max)}</span>
      </div>
      <div className="relative h-2 rounded-full" style={{ backgroundColor: '#16162A' }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#4F46E5,#7C3AED)' }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
        />
      </div>
    </div>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function Step1({ data, onChange, errors }) {
  const [cityQuery, setCityQuery] = useState('');
  const [cityOpen, setCityOpen] = useState(false);

  const filtered = INDIAN_CITIES.filter((c) =>
    c.city.toLowerCase().includes(cityQuery.toLowerCase())
  ).slice(0, 8);

  const selectCity = (entry) => {
    onChange({ city: entry.city, state: entry.state });
    setCityQuery(entry.city);
    setCityOpen(false);
  };

  return (
    <StepContainer>
      <StepHeading
        title="Let's get to know you"
        subtitle="Basic info to personalise your FinHabits experience."
      />

      <Field label="Full name" error={errors.name}>
        <Input
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Priya Sharma"
        />
      </Field>

      <Field label="Phone number" error={errors.phone}>
        <Input
          value={data.phone}
          onChange={(e) => onChange({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
          placeholder="9876543210"
          prefix="+91"
          type="tel"
          inputMode="numeric"
        />
      </Field>

      <Field label="City" error={errors.city}>
        <div className="relative">
          <Input
            value={cityQuery}
            onChange={(e) => { setCityQuery(e.target.value); setCityOpen(true); onChange({ city: '', state: '' }); }}
            onFocus={() => setCityOpen(true)}
            placeholder="Search your city…"
          />
          {cityOpen && filtered.length > 0 && (
            <div
              className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl border border-white/10 overflow-hidden shadow-lg"
              style={{ backgroundColor: '#16162A' }}
            >
              {filtered.map((entry) => (
                <button
                  key={entry.city}
                  type="button"
                  onMouseDown={() => selectCity(entry)}
                  className="w-full text-left px-4 py-2.5 font-body text-sm text-text-primary hover:bg-white/5 transition-colors flex justify-between items-center"
                >
                  <span>{entry.city}</span>
                  <span className="text-xs text-text-secondary">{entry.state}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>

      <Field label="State">
        <Input value={data.state} readOnly placeholder="Auto-filled from city" />
      </Field>
    </StepContainer>
  );
}

function Step2({ data, onChange, errors }) {
  const fmt = (v) => `₹${v.toLocaleString('en-IN')}`;

  return (
    <StepContainer>
      <StepHeading
        title="Your financial profile"
        subtitle="Helps FinHabits suggest smarter budgets."
      />

      <Field label="Monthly income" error={errors.monthlyIncome}>
        <RangeSlider
          value={data.monthlyIncome}
          onChange={(v) => onChange({ monthlyIncome: v })}
          min={5000}
          max={500000}
          step={1000}
          formatLabel={fmt}
        />
      </Field>

      <Field label="Employment type" error={errors.employmentType}>
        <div className="flex flex-wrap gap-2">
          {EMPLOYMENT_TYPES.map((t) => (
            <PillButton key={t} selected={data.employmentType === t} onClick={() => onChange({ employmentType: t })}>
              {t}
            </PillButton>
          ))}
        </div>
      </Field>

      <Field label="Salary / income credit date">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
          {SALARY_DATES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChange({ salaryDate: d })}
              className={`flex-shrink-0 snap-center w-10 h-10 rounded-xl font-mono text-xs font-medium transition-all duration-200
                ${data.salaryDate === d
                  ? 'text-white shadow-glow'
                  : 'text-text-secondary border border-white/10 hover:border-white/25'
                }`}
              style={data.salaryDate === d
                ? { background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', border: 'none' }
                : { backgroundColor: '#16162A' }}
            >
              {d}
            </button>
          ))}
        </div>
        <p className="font-body text-xs text-text-secondary mt-1">Day of month you receive income</p>
      </Field>

      <Field label="Monthly savings goal (optional)">
        <RangeSlider
          value={data.savingsGoal ?? 0}
          onChange={(v) => onChange({ savingsGoal: v })}
          min={0}
          max={data.monthlyIncome}
          step={500}
          formatLabel={(v) => v === 0 ? 'Skip' : fmt(v)}
        />
      </Field>
    </StepContainer>
  );
}

function Step3({ data, onChange }) {
  return (
    <StepContainer>
      <StepHeading
        title="Your banking setup"
        subtitle="FinHabits needs to know which banks to expect SMS from."
      />

      <Field label="Primary banks (select all that apply)">
        <MultiChip
          options={BANKS}
          selected={data.primaryBanks}
          onChange={(v) => onChange({ primaryBanks: v })}
        />
      </Field>

      <Field label="UPI apps you use">
        <MultiChip
          options={UPI_APPS}
          selected={data.upiApps}
          onChange={(v) => onChange({ upiApps: v })}
        />
      </Field>
    </StepContainer>
  );
}

function Step4({ data, onChange }) {
  return (
    <StepContainer>
      <StepHeading
        title="Your preferences"
        subtitle="Customise how FinHabits works for you."
      />

      <Field label="Preferred language">
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => (
            <PillButton key={lang} selected={data.language === lang} onClick={() => onChange({ language: lang })}>
              {lang}
            </PillButton>
          ))}
        </div>
      </Field>

      <Field label="Notifications">
        <div className="rounded-xl border border-white/10 px-4 divide-y divide-white/5"
             style={{ backgroundColor: '#16162A' }}>
          <Toggle
            checked={data.notifyWeekly ?? true}
            onChange={(v) => onChange({ notifyWeekly: v })}
            label="Weekly insights summary"
          />
          <Toggle
            checked={data.notifyBudget ?? true}
            onChange={(v) => onChange({ notifyBudget: v })}
            label="Budget overspend alerts"
          />
          <Toggle
            checked={data.notifyLargeSpend ?? true}
            onChange={(v) => onChange({ notifyLargeSpend: v })}
            label="Large transaction alerts"
          />
        </div>
      </Field>

      <Field label="Default currency">
        <div className="px-4 py-3 rounded-xl border border-white/10 font-body text-sm flex items-center gap-2"
             style={{ backgroundColor: '#16162A' }}>
          <span className="text-text-primary">🇮🇳 Indian Rupee (INR ₹)</span>
          <span className="ml-auto text-xs text-text-secondary">Locked</span>
        </div>
      </Field>
    </StepContainer>
  );
}

function Step5({ data, onChange, income }) {
  const suggest = (catId) => Math.round(((BUDGET_SUGGESTIONS[catId] || 10) / 100) * income / 1000) * 1000;

  return (
    <StepContainer>
      <StepHeading
        title="Set your monthly budgets"
        subtitle="Suggested amounts based on your income. Adjust to match your lifestyle."
      />

      <div className="space-y-5">
        {BUDGET_CATEGORIES.map((cat) => {
          const suggestion = suggest(cat.id);
          const current = data.budgets?.[cat.id] ?? suggestion;
          return (
            <div key={cat.id} className="rounded-xl p-4 border border-white/8" style={{ backgroundColor: '#16162A' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cat.icon}</span>
                  <span className="font-body text-sm font-medium text-text-primary">{cat.name}</span>
                </div>
                <span
                  className="font-mono text-xs px-2 py-1 rounded-lg"
                  style={{ backgroundColor: `${cat.color}22`, color: cat.color }}
                >
                  {BUDGET_SUGGESTIONS[cat.id]}% of income
                </span>
              </div>
              <RangeSlider
                value={current}
                onChange={(v) => onChange({ budgets: { ...data.budgets, [cat.id]: v } })}
                min={0}
                max={Math.round(income * 0.5 / 1000) * 1000 || 50000}
                step={500}
                formatLabel={(v) => v === 0 ? 'Skip' : `₹${v.toLocaleString('en-IN')}`}
              />
            </div>
          );
        })}
      </div>

      <p className="font-body text-xs text-text-secondary text-center">
        You can update budgets anytime from Settings.
      </p>
    </StepContainer>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between font-body text-xs text-text-secondary">
        <span>Step {current} of {total}</span>
        <span>{Math.round((current / total) * 100)}% complete</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#16162A' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg,#4F46E5,#7C3AED)' }}
          animate={{ width: `${(current / total) * 100}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        />
      </div>
    </div>
  );
}

// ─── Validate ─────────────────────────────────────────────────────────────────

const validate = (step, data) => {
  const errs = {};
  if (step === 1) {
    if (!data.name?.trim()) errs.name = 'Name is required';
    if (!data.phone || data.phone.length !== 10) errs.phone = 'Enter a valid 10-digit number';
    if (!data.city) errs.city = 'Please select a city';
  }
  if (step === 2) {
    if (!data.employmentType) errs.employmentType = 'Please select employment type';
    if (!data.salaryDate) errs.salaryDate = 'Please select salary date';
  }
  return errs;
};

// ─── Main Onboarding ─────────────────────────────────────────────────────────

const INITIAL = {
  name: '',
  phone: '',
  city: '',
  state: '',
  monthlyIncome: 50000,
  employmentType: '',
  salaryDate: null,
  savingsGoal: 0,
  primaryBanks: [],
  upiApps: [],
  language: 'English',
  notifyWeekly: true,
  notifyBudget: true,
  notifyLargeSpend: true,
  budgets: {},
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const { addToast } = useUIStore();

  const [step, setStep] = useState(1);
  const [data, setData] = useState({ ...INITIAL, name: user?.displayName || '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const update = useCallback((patch) => setData((prev) => ({ ...prev, ...patch })), []);

  const goNext = () => {
    const errs = validate(step, data);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  };

  const goBack = () => { setErrors({}); setStep((s) => Math.max(1, s - 1)); };

  const handleComplete = async () => {
    setSaving(true);
    try {
      // Build Firestore profile document (matching exact schema from guidelines)
      const profile = {
        name: data.name.trim(),
        email: user?.email || '',
        phone: `+91${data.phone}`,
        city: data.city,
        state: data.state,
        monthlyIncome: String(data.monthlyIncome), // Will be encrypted in Prompt 4 backend call
        employmentType: data.employmentType,
        salaryDate: data.salaryDate,
        primaryBanks: data.primaryBanks,
        upiApps: data.upiApps,
        language: data.language,
        createdAt: serverTimestamp(),
      };

      // Write profile — required step
      await setDoc(doc(db, 'users', user.uid, 'profile', 'data'), profile);

      // Write budgets — best-effort, don't block onboarding if this fails
      const budgetEntries = Object.entries(data.budgets).filter(([, amount]) => amount > 0);
      await Promise.allSettled(
        budgetEntries.map(([catId, amount]) =>
          setDoc(doc(db, 'users', user.uid, 'budgets', catId), {
            limit: String(amount),
            rollover: false,
            updatedAt: serverTimestamp(),
          })
        )
      );

      addToast({ type: 'success', title: 'Welcome to FinHabits! 🎉', message: 'Your profile is set up.' });
      // Mark onboarding complete in store immediately so router doesn't re-redirect
      setUser({ ...user, isNewUser: false });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const isOffline = err.code === 'unavailable' || err.message?.includes('offline') || err.message?.includes('client is offline');
      const isPermission = err.code === 'permission-denied' || err.message?.includes('Missing or insufficient permissions');
      const message = isPermission
        ? 'Firestore permission denied — update your Firestore Security Rules in Firebase Console to allow authenticated users to write their data.'
        : isOffline
        ? 'Cannot reach Firestore — check your Firestore Security Rules in Firebase Console (locked mode blocks all writes).'
        : err.message;
      addToast({ type: 'error', title: 'Setup failed', message, duration: 8000 });
      console.error('Onboarding save error:', err);
      setSaving(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-start justify-center py-10 px-4"
      style={{ backgroundColor: '#0F0F1A' }}
    >
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="font-heading text-2xl font-bold text-text-primary">
            Fin<span style={{ color: '#4F46E5' }}>Habits</span>
          </span>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl border border-white/8 overflow-hidden"
          style={{ backgroundColor: '#16162A' }}
        >
          {/* Progress */}
          <div className="px-6 pt-6 pb-4 border-b border-white/5">
            <ProgressBar current={step} total={TOTAL_STEPS} />
          </div>

          {/* Step Content */}
          <div className="px-6 py-6 min-h-[360px]">
            <AnimatePresence mode="wait">
              {step === 1 && <Step1 key={1} data={data} onChange={update} errors={errors} />}
              {step === 2 && <Step2 key={2} data={data} onChange={update} errors={errors} />}
              {step === 3 && <Step3 key={3} data={data} onChange={update} />}
              {step === 4 && <Step4 key={4} data={data} onChange={update} />}
              {step === 5 && <Step5 key={5} data={data} onChange={update} income={data.monthlyIncome} />}
            </AnimatePresence>
          </div>

          {/* Nav Buttons */}
          <div className="px-6 pb-6 flex gap-3">
            {step > 1 && (
              <button
                onClick={goBack}
                className="flex-1 py-3.5 rounded-2xl font-body font-medium text-text-secondary border border-white/10 hover:border-white/20 hover:text-text-primary transition-colors"
                style={{ backgroundColor: '#0F0F1A' }}
              >
                Back
              </button>
            )}

            {step < TOTAL_STEPS ? (
              <button
                onClick={goNext}
                className="flex-1 py-3.5 rounded-2xl font-body font-semibold text-white transition-opacity"
                style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={saving}
                className="flex-1 py-3.5 rounded-2xl font-body font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Saving…
                  </span>
                ) : (
                  'Complete Setup 🎉'
                )}
              </button>
            )}
          </div>

          {/* Skip for steps 3–5 */}
          {step >= 3 && step < TOTAL_STEPS && (
            <div className="px-6 pb-5 -mt-3 text-center">
              <button
                onClick={() => setStep((s) => s + 1)}
                className="font-body text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                Skip for now →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
