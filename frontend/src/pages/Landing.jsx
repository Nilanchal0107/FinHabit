import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { signInWithGoogle } from '@services/firebase.js';
import { useUIStore } from '@store/uiStore.js';
import AnimatedSMSDemo from '@components/common/AnimatedSMSDemo.jsx';

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '⚡',
    title: 'Zero Manual Entry',
    desc: 'Paste SMS, done. FinHabits reads every number, merchant and date — automatically.',
    color: '#4F46E5',
  },
  {
    icon: '🧠',
    title: 'AI That Learns You',
    desc: 'Gets smarter every transaction. After 5 confirmations it auto-categorises without asking.',
    color: '#7C3AED',
  },
  {
    icon: '🔒',
    title: '100% Private',
    desc: 'Your data, encrypted, always. AES-256 encryption before storage. We never read your SMS.',
    color: '#0D9488',
  },
];

const HOW_STEPS = [
  { n: '01', title: 'Sign in with Google', desc: 'One tap — no passwords, no email verification.' },
  { n: '02', title: 'Paste your bank SMS', desc: 'Copy any transaction SMS and paste, or share it directly from your messages app.' },
  { n: '03', title: 'Get instant insights', desc: 'AI extracts every detail and builds your complete financial picture.' },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function FadeUp({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function GoogleSignInButton({ onClick, loading }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={loading}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="inline-flex items-center gap-3 px-7 py-3.5 rounded-2xl font-body font-semibold text-white shadow-glow transition-opacity disabled:opacity-60"
      style={{ background: 'linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)' }}
    >
      {loading ? (
        <span className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
      ) : (
        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="rgba(255,255,255,0.7)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="rgba(255,255,255,0.5)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="rgba(255,255,255,0.3)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
      {loading ? 'Signing in…' : 'Start Free — Sign in with Google'}
    </motion.button>
  );
}

// ─── PWA Install Prompt ───────────────────────────────────────────────────────

function PWAInstallPrompt({ onDismiss }) {
  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-50 p-5 rounded-t-3xl border-t border-white/10"
      style={{ backgroundColor: '#16162A' }}
      role="dialog"
      aria-label="Install FinHabits"
    >
      <div className="max-w-md mx-auto">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
            style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
          >
            💸
          </div>
          <div className="flex-1">
            <h3 className="font-heading text-lg font-bold text-text-primary">Add to Home Screen</h3>
            <p className="font-body text-sm text-text-secondary mt-1">
              Install FinHabits for instant access — no App Store needed.
            </p>
          </div>
        </div>
        <div className="mt-4 p-3.5 rounded-xl text-sm font-body text-text-secondary border border-white/8"
             style={{ backgroundColor: '#0F0F1A' }}>
          Tap <strong className="text-text-primary">Share</strong> → <strong className="text-text-primary">Add to Home Screen</strong> in Safari, or look for the install icon in your browser's address bar.
        </div>
        <button
          onClick={onDismiss}
          className="mt-4 w-full py-3.5 rounded-2xl font-body font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
        >
          Got it
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Landing() {
  const { addToast } = useUIStore();
  const [signingIn, setSigningIn] = useState(false);
  const [showPWA, setShowPWA] = useState(false);
  const deferredPrompt = useRef(null);

  // Capture beforeinstallprompt + show sheet after 30s
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
    };
    window.addEventListener('beforeinstallprompt', handler);

    const timer = setTimeout(() => setShowPWA(true), 30_000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') deferredPrompt.current = null;
    }
    setShowPWA(false);
  };

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
      // Routing handled by App.jsx → onAuthStateChanged
    } catch (err) {
      addToast({ type: 'error', title: 'Sign-in failed', message: err.message });
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F0F1A', color: '#F0EFF8' }}>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-4 max-w-6xl mx-auto">
        <span className="font-heading text-xl font-bold">
          Fin<span style={{ color: '#4F46E5' }}>Habits</span>
        </span>
        <button
          onClick={handleGoogleSignIn}
          disabled={signingIn}
          className="px-4 py-2 rounded-xl font-body text-sm font-medium text-text-secondary border border-white/10 hover:border-white/20 hover:text-text-primary transition-colors disabled:opacity-50"
        >
          Sign in
        </button>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 pt-12 pb-20 lg:pt-20 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        <div className="text-center lg:text-left">
          {/* Badge */}
          <FadeUp>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 mb-6"
                 style={{ backgroundColor: 'rgba(79,70,229,0.12)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-soft" />
              <span className="font-body text-xs font-medium text-text-secondary">
                Google Solution Challenge 2026
              </span>
            </div>
          </FadeUp>

          <FadeUp delay={0.08}>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-text-primary">
              Your bank SMS.{' '}
              <span style={{
                background: 'linear-gradient(135deg,#4F46E5,#7C3AED)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Your financial story.
              </span>
            </h1>
          </FadeUp>

          <FadeUp delay={0.16}>
            <p className="font-body text-lg text-text-secondary mt-5 leading-relaxed max-w-lg mx-auto lg:mx-0">
              FinHabits turns every payment SMS into a smart financial insight — automatically.
            </p>
          </FadeUp>

          <FadeUp delay={0.24}>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <GoogleSignInButton onClick={handleGoogleSignIn} loading={signingIn} />
            </div>
            <p className="mt-3 font-body text-xs text-text-secondary">
              Free forever · No credit card · Works with all Indian banks
            </p>
          </FadeUp>
        </div>

        {/* Animated SMS Demo */}
        <FadeUp delay={0.1} className="flex justify-center">
          <AnimatedSMSDemo />
        </FadeUp>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 py-20 border-t border-white/5">
        <FadeUp className="text-center mb-14">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text-primary">
            Built for the way India pays
          </h2>
          <p className="font-body text-text-secondary mt-3 max-w-xl mx-auto">
            UPI, NEFT, IMPS, card swipes — FinHabits understands every format from every bank.
          </p>
        </FadeUp>

        <div className="grid sm:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <FadeUp key={f.title} delay={i * 0.1}>
              <div
                className="h-full rounded-2xl p-6 border border-white/8 hover:border-white/15 transition-colors duration-300"
                style={{ backgroundColor: '#16162A' }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4"
                  style={{ backgroundColor: `${f.color}22` }}
                >
                  {f.icon}
                </div>
                <h3 className="font-heading text-lg font-bold text-text-primary mb-2">{f.title}</h3>
                <p className="font-body text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 py-20 border-t border-white/5">
        <FadeUp className="text-center mb-14">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text-primary">
            Up and running in 60 seconds
          </h2>
        </FadeUp>

        <div className="grid sm:grid-cols-3 gap-8 relative">
          {/* Connector lines (desktop only) */}
          <div className="hidden sm:block absolute top-8 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {HOW_STEPS.map((step, i) => (
            <FadeUp key={step.n} delay={i * 0.12} className="text-center relative">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10"
                style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
              >
                <span className="font-mono text-2xl font-bold text-white">{step.n}</span>
              </div>
              <h3 className="font-heading text-lg font-bold text-text-primary mb-2">{step.title}</h3>
              <p className="font-body text-sm text-text-secondary leading-relaxed">{step.desc}</p>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 py-20 border-t border-white/5">
        <FadeUp className="text-center">
          <div
            className="rounded-3xl p-10 sm:p-16 border border-white/8 relative overflow-hidden"
            style={{ backgroundColor: '#16162A' }}
          >
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none"
                 style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%,rgba(79,70,229,0.15),transparent)' }} />
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-4 relative">
              Start building better money habits today
            </h2>
            <p className="font-body text-text-secondary mb-8 max-w-lg mx-auto relative">
              Join thousands of Indians already tracking smarter with FinHabits.
            </p>
            <div className="relative">
              <GoogleSignInButton onClick={handleGoogleSignIn} loading={signingIn} />
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 text-center">
        <p className="font-body text-sm text-text-secondary">
          © 2026 FinHabits · Built for{' '}
          <span style={{ color: '#4F46E5' }}>Google Solution Challenge</span>
        </p>
      </footer>

      {/* ── PWA Install Sheet ─────────────────────────────────────────────── */}
      {showPWA && (
        <PWAInstallPrompt onDismiss={() => setShowPWA(false)} onInstall={handleInstall} />
      )}
    </div>
  );
}