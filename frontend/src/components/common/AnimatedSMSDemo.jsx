import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

const SMS_TEXT =
  'Dear BOB User: Your account is debited with INR 450.00 on 21-Mar-2026 by ZOMATO LTD UPI Ref No 123456789';

const PARSED_FIELDS = [
  { label: 'Amount',   value: '₹450',  delay: 0    },
  { label: 'Merchant', value: 'Zomato', delay: 0.35 },
  { label: 'Category', value: 'Food 🍽️', delay: 0.7 },
];

/**
 * Animated SMS → Parse → Confirm card demo.
 * Loops every 6 seconds.
 */
export default function AnimatedSMSDemo() {
  // phase: 'sms' → 'parsing' → 'card' → back to 'sms'
  const [phase, setPhase] = useState('sms');
  const [visibleFields, setVisibleFields] = useState([]);

  useEffect(() => {
    let timers = [];

    const runCycle = () => {
      setPhase('sms');
      setVisibleFields([]);

      // After 1.5s — start revealing parsed fields one by one
      timers.push(setTimeout(() => setPhase('parsing'), 1500));
      PARSED_FIELDS.forEach((_, i) => {
        timers.push(
          setTimeout(
            () => setVisibleFields((prev) => [...prev, i]),
            1500 + 400 + i * 380
          )
        );
      });

      // After 3.3s — show confirmation card
      timers.push(setTimeout(() => setPhase('card'), 3300));
    };

    runCycle();
    const loop = setInterval(runCycle, 6000);
    timers.push(loop);

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Phone shell */}
      <div
        className="rounded-3xl border border-white/10 overflow-hidden shadow-glow-violet"
        style={{ backgroundColor: '#16162A' }}
      >
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="font-mono text-[10px] text-text-secondary">9:41 AM</span>
          <span className="font-mono text-[10px] text-text-secondary">BOB Bank</span>
        </div>

        <div className="px-4 pb-5 space-y-3">
          {/* SMS bubble */}
          <motion.div
            className="rounded-2xl rounded-tl-sm p-3.5 text-sm font-body leading-relaxed"
            style={{ backgroundColor: '#1E1E35' }}
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
          >
            <p className="text-text-secondary text-[11px] font-medium mb-1.5">BOB BANK</p>
            <p className="text-text-primary text-xs leading-relaxed">{SMS_TEXT}</p>
          </motion.div>

          {/* Parsed fields */}
          <AnimatePresence>
            {phase !== 'sms' && (
              <div className="grid grid-cols-3 gap-2">
                {PARSED_FIELDS.map((field, i) => (
                  <AnimatePresence key={field.label}>
                    {visibleFields.includes(i) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                        className="rounded-xl p-2.5 text-center border border-white/5"
                        style={{ backgroundColor: 'rgba(34,197,94,0.08)' }}
                      >
                        <p className="text-[9px] font-body text-text-secondary mb-0.5">{field.label}</p>
                        <p className="text-[11px] font-body font-semibold text-success leading-tight">
                          {field.value}
                        </p>
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.1, type: 'spring', stiffness: 500 }}
                          className="text-success text-[10px]"
                        >
                          ✓
                        </motion.span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* Confirmation card */}
          <AnimatePresence>
            {phase === 'card' && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className="rounded-2xl p-3.5 border border-white/10"
                style={{ backgroundColor: '#0F0F1A' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-body text-xs text-text-secondary">Zomato · Food</p>
                    <p className="font-mono text-lg font-medium text-text-primary">₹450.00</p>
                  </div>
                  <span className="text-2xl">🍽️</span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex-1 py-2 rounded-xl text-xs font-body font-semibold text-white transition-opacity"
                    style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
                  >
                    Save ✓
                  </button>
                  <button
                    className="flex-1 py-2 rounded-xl text-xs font-body font-medium text-text-secondary border border-white/10"
                    style={{ backgroundColor: '#16162A' }}
                  >
                    Edit
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Ambient glow behind phone */}
      <div
        className="absolute -inset-4 -z-10 rounded-3xl blur-3xl opacity-20"
        style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
      />
    </div>
  );
}
