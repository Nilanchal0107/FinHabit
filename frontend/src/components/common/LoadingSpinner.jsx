import { motion } from 'framer-motion';

/**
 * LoadingSpinner — animated gradient ring.
 *
 * @param {object} props
 * @param {'sm'|'md'|'lg'|'xl'} [props.size]
 * @param {string} [props.className]
 * @param {string} [props.label]
 */
export default function LoadingSpinner({ size = 'md', className = '', label = 'Loading…' }) {
  const sizes = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-[3px]',
    xl: 'w-16 h-16 border-4',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status" aria-label={label}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        className={`rounded-full border-text-secondary ${sizes[size]}`}
        style={{ borderTopColor: '#4F46E5' }}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Full-screen loading overlay.
 */
export function FullScreenLoader({ label = 'Loading FinHabits…' }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: '#0F0F1A' }}
    >
      <span className="font-heading text-2xl font-bold text-text-primary">
        Fin<span style={{ color: '#4F46E5' }}>Habits</span>
      </span>
      <LoadingSpinner size="lg" label={label} />
      <p className="font-body text-text-secondary text-sm">{label}</p>
    </div>
  );
}
