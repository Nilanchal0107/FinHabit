import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Auth store — persists user to localStorage.
 * user shape mirrors Firebase User object (serializable subset).
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      loading: true,
      error: null,

      setUser: (user) =>
        set({
          user: user
            ? {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                phoneNumber: user.phoneNumber,
                emailVerified: user.emailVerified,
                isNewUser: user.isNewUser ?? false,
              }
            : null,
          loading: false,
          error: null,
        }),

      clearUser: () =>
        set({
          user: null,
          loading: false,
          error: null,
        }),

      setLoading: (loading) => set({ loading }),

      setError: (error) => set({ error }),
    }),
    {
      name: 'finhabits-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
