/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',
        violet: '#7C3AED',
        teal: '#0D9488',
        amber: '#F59E0B',
        coral: '#F43F5E',
        success: '#22C55E',
        bg: {
          dark: '#0F0F1A',
          surface: '#16162A',
        },
        text: {
          primary: '#F0EFF8',
          secondary: '#8B8A9E',
        },
      },
      fontFamily: {
        heading: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        'gradient-surface': 'linear-gradient(180deg, #16162A 0%, #0F0F1A 100%)',
      },
      boxShadow: {
        glow: '0 0 20px rgba(79, 70, 229, 0.3)',
        'glow-violet': '0 0 20px rgba(124, 58, 237, 0.3)',
        'glow-coral': '0 0 20px rgba(244, 63, 94, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
    },
  },
  plugins: [],
};
