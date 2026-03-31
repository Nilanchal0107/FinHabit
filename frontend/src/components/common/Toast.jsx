import { forwardRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore } from '@store/uiStore.js';

const TYPE_STYLES = {
  success: { border: '#22C55E', icon: '✓', iconBg: 'rgba(34,197,94,0.15)' },
  error:   { border: '#F43F5E', icon: '✕', iconBg: 'rgba(244,63,94,0.15)' },
  warning: { border: '#F59E0B', icon: '⚠', iconBg: 'rgba(245,158,11,0.15)' },
  info:    { border: '#4F46E5', icon: 'ℹ', iconBg: 'rgba(79,70,229,0.15)' },
};

/**
 * ToastItem must use React.forwardRef so that AnimatePresence mode="popLayout"
 * can attach its layout-measurement ref to the DOM node. Without forwardRef,
 * React warns "Function components cannot be given refs" and the layout
 * animation is skipped.
 */
const ToastItem = forwardRef(function ToastItem({ toast }, ref) {
  const { removeToast } = useUIStore();
  const style = TYPE_STYLES[toast.type] || TYPE_STYLES.info;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, x: 48, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex items-start gap-3 w-80 p-4 rounded-2xl border shadow-lg"
      style={{
        backgroundColor: '#16162A',
        borderColor: `${style.border}40`,
        borderLeftWidth: '3px',
        borderLeftColor: style.border,
      }}
      role="alert"
    >
      {/* Icon */}
      <span
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
        style={{ backgroundColor: style.iconBg, color: style.border }}
      >
        {style.icon}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="font-body font-medium text-sm text-text-primary leading-snug">{toast.title}</p>
        )}
        {toast.message && (
          <p className="font-body text-xs text-text-secondary mt-0.5 leading-snug">{toast.message}</p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 text-text-secondary hover:text-text-primary transition-colors text-lg leading-none"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </motion.div>
  );
});

export default function Toast() {
  const { toasts } = useUIStore();

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
