import { create } from 'zustand';

let toastIdCounter = 0;

/**
 * UI store — manages toasts, modals, FAB state, and chatbot visibility.
 */
export const useUIStore = create((set, get) => ({
  // Toast notifications
  toasts: [],

  addToast: ({ type = 'info', title, message, duration = 4000 }) => {
    const id = ++toastIdCounter;
    set((state) => ({
      toasts: [...state.toasts, { id, type, title, message, duration }],
    }));
    if (duration > 0) {
      setTimeout(() => get().removeToast(id), duration);
    }
    return id;
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearToasts: () => set({ toasts: [] }),

  // FAB (Floating Action Button) state
  fabOpen: false,
  setFabOpen: (open) => set({ fabOpen: open }),
  toggleFab: () => set((state) => ({ fabOpen: !state.fabOpen })),

  // ChatBot visibility
  chatOpen: false,
  setChatOpen: (open) => set({ chatOpen: open }),
  toggleChat: () => set((state) => ({ chatOpen: !state.chatOpen })),

  // Active modal (e.g. 'sms-input', 'transaction-confirm', 'category-picker')
  activeModal: null,
  modalData: null,

  openModal: (name, data = null) => set({ activeModal: name, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),

  // Global nav active tab
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Active category filter (set by SpendingPieChart, read by RecentTransactions)
  activeCategory: null,
  setActiveCategory: (category) => set({ activeCategory: category }),
  clearActiveCategory: () => set({ activeCategory: null }),
}));
