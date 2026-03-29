import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';

import Navbar from '@components/common/Navbar.jsx';
import FAB from '@components/common/FAB.jsx';
import ChatBot from '@components/common/ChatBot.jsx';
import Toast from '@components/common/Toast.jsx';
import { FullScreenLoader } from '@components/common/LoadingSpinner.jsx';
import AddTransactionModal from '@components/transactions/AddTransactionModal.jsx';

import Landing from '@pages/Landing.jsx';
import Onboarding from '@pages/Onboarding.jsx';
import Dashboard from '@pages/Dashboard.jsx';
import Transactions from '@pages/Transactions.jsx';
import Calendar from '@pages/Calendar.jsx';
import Insights from '@pages/Insights.jsx';
import Settings from '@pages/Settings.jsx';

// ─── Auth Guard (protected route wrapper) ───────────────────────────────────

function RequireAuth({ children }) {
  const { user, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <Navigate to="/landing" state={{ from: location }} replace />;
  }

  return children;
}

// ─── Public route (redirect if already signed in) ───────────────────────────

function PublicRoute({ children }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (user) {
    // New users (no Firestore profile) go to onboarding
    return <Navigate to={user.isNewUser ? '/onboarding' : '/dashboard'} replace />;
  }

  return children;
}

// ─── Layout wrapping protected pages ────────────────────────────────────────

function AppLayout({ children }) {
  return (
    <div className="min-h-screen font-body" style={{ backgroundColor: '#0F0F1A', color: '#F0EFF8' }}>
      <Navbar />
      {/* Top padding on desktop (fixed header), bottom padding on mobile (fixed nav) */}
      <main className="pt-0 md:pt-16 pb-20 md:pb-0 min-h-screen">
        {children}
      </main>
      <FAB />
      <ChatBot />
      <AddTransactionModal />
    </div>
  );
}

// ─── Firebase auth listener ──────────────────────────────────────────────────

function AuthListener() {
  const { setUser, clearUser, setLoading } = useAuthStore();

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (firebaseUser) {
          // Check if this user has a complete onboarding profile
          try {
            const profileSnap = await getDoc(doc(db, 'users', firebaseUser.uid, 'profile', 'data'));
            // Profile must exist AND have a 'name' field to be considered complete
            const profileComplete = profileSnap.exists() && !!profileSnap.data()?.name;
            setUser({ ...firebaseUser, isNewUser: !profileComplete });
          } catch (err) {
            // Firestore unavailable (permissions, network etc.) — show onboarding to be safe
            console.error('Firestore profile check failed:', err.message);
            setUser({ ...firebaseUser, isNewUser: true });
          }
        } else {
          clearUser();
        }
      },
      (error) => {
        console.error('Auth state error:', error.message);
        clearUser();
      }
    );
    return unsubscribe;
  }, [setUser, clearUser, setLoading]);

  return null;
}

// ─── Root App ────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AuthListener />
      <Toast />
      <Routes>
        {/* Public */}
        <Route
          path="/landing"
          element={
            <PublicRoute>
              <Landing />
            </PublicRoute>
          }
        />

        {/* Protected — Onboarding (no Navbar/FAB, full-screen layout) */}
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <Onboarding />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/transactions"
          element={
            <RequireAuth>
              <AppLayout>
                <Transactions />
              </AppLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/calendar"
          element={
            <RequireAuth>
              <AppLayout>
                <Calendar />
              </AppLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/insights"
          element={
            <RequireAuth>
              <AppLayout>
                <Insights />
              </AppLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <AppLayout>
                <Settings />
              </AppLayout>
            </RequireAuth>
          }
        />

        {/* Catch-all → redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
