import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@store/authStore.js';
import { useUIStore } from '@store/uiStore.js';
import { signOut } from '@services/firebase.js';

const NAV_ITEMS = [
  { path: '/dashboard',     label: 'Dashboard',    icon: '⊞' },
  { path: '/transactions',  label: 'Transactions', icon: '↕' },
  { path: '/calendar',      label: 'Calendar',     icon: '📅' },
  { path: '/insights',      label: 'Insights',     icon: '✦' },
  { path: '/settings',      label: 'Settings',     icon: '⚙' },
];

export default function Navbar() {
  const location = useLocation();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();

  const handleSignOut = async () => {
    try {
      await signOut();
      addToast({ type: 'success', title: 'Signed out', message: 'See you soon!' });
    } catch (err) {
      addToast({ type: 'error', title: 'Sign out failed', message: err.message });
    }
  };

  return (
    <>
      {/* Desktop top bar */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-40 h-16 items-center justify-between px-6 border-b border-white/5"
              style={{ backgroundColor: '#16162A' }}>
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="font-heading text-xl font-bold text-text-primary">
            Fin<span style={{ color: '#4F46E5' }}>Habits</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative px-4 py-2 rounded-xl text-sm font-body font-medium transition-colors duration-200
                  ${isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl"
                    style={{ backgroundColor: 'rgba(79,70,229,0.2)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-body text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors duration-200"
        >
          {user?.photoURL && (
            <img src={user.photoURL} alt={user.displayName || 'User'} className="w-7 h-7 rounded-full" />
          )}
          Sign out
        </button>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2 border-t border-white/5"
           style={{ backgroundColor: '#16162A' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors duration-200
                ${isActive ? 'text-text-primary' : 'text-text-secondary'}`}
            >
              {isActive && (
                <motion.span
                  layoutId="mobile-nav-active"
                  className="absolute inset-0 rounded-xl"
                  style={{ backgroundColor: 'rgba(79,70,229,0.2)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative text-lg leading-none">{item.icon}</span>
              <span className="relative text-[10px] font-body font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
