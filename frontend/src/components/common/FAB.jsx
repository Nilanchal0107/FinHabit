import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@store/uiStore.js';

const FAB_ACTIONS = [
  { id: 'sms',    label: 'Paste SMS',    icon: '📱', color: '#4F46E5' },
  { id: 'manual', label: 'Manual Entry', icon: '✏️',  color: '#7C3AED' },
  { id: 'share',  label: 'SMS Share',    icon: '📤',  color: '#0D9488' },
];

export default function FAB() {
  const { fabOpen, toggleFab, openModal } = useUIStore();

  const handleAction = (actionId) => {
    toggleFab();
    openModal(actionId);
  };

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex flex-col-reverse items-end gap-3">
      {/* Action buttons */}
      <AnimatePresence>
        {fabOpen &&
          FAB_ACTIONS.map((action, i) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 16, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.8 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 400, damping: 25 }}
              className="flex items-center gap-3"
            >
              <span className="font-body text-sm text-text-primary bg-bg-surface px-3 py-1.5 rounded-xl shadow-lg border border-white/10 whitespace-nowrap">
                {action.label}
              </span>
              <button
                onClick={() => handleAction(action.id)}
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-lg border border-white/10 transition-transform duration-150 active:scale-95"
                style={{ backgroundColor: action.color }}
                aria-label={action.label}
              >
                {action.icon}
              </button>
            </motion.div>
          ))}
      </AnimatePresence>

      {/* Main FAB button */}
      <motion.button
        onClick={toggleFab}
        whileTap={{ scale: 0.92 }}
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-glow border border-white/10 transition-colors duration-200"
        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
        aria-label={fabOpen ? 'Close menu' : 'Add transaction'}
        aria-expanded={fabOpen}
      >
        <motion.span
          animate={{ rotate: fabOpen ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="text-2xl leading-none text-white font-bold"
        >
          +
        </motion.span>
      </motion.button>
    </div>
  );
}
