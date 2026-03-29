import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore } from '@store/uiStore.js';

export default function ChatBot() {
  const { chatOpen } = useUIStore();

  return (
    <AnimatePresence>
      {chatOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-24 z-50 w-80 rounded-2xl border border-white/10 shadow-glow-violet overflow-hidden"
          style={{ backgroundColor: '#16162A' }}
          role="dialog"
          aria-label="FinHabits AI Assistant"
        >
          <div className="h-96 flex items-center justify-center">
            <p className="font-body text-text-secondary text-sm">AI chat coming in Prompt 4</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
