/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ELVO Brand Palette
        elvo: {
          noir:   '#2B2B2B',  // Charcoal Noir  — primary dark
          iron:   '#565656',  // Ironclad Grey  — secondary
          fog:    '#848484',  // Urban Fog      — muted text
          silver: '#B3B3B3',  // Moonlit Silver — borders/subtle
          cloud:  '#E0E0E0',  // Cloud Veil     — light bg / cards
          white:  '#F5F5F5',  // Off-white surface
        },
        // Legacy brand (kept for backward compat)
        brand: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        display: [
          'Georgia',
          '"Times New Roman"',
          'serif',
        ],
      },
      boxShadow: {
        'subtle':  '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'card':    '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'popover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'elvo':    '0 8px 32px rgba(43, 43, 43, 0.18)',
        'elvo-lg': '0 20px 60px rgba(43, 43, 43, 0.25)',
      },
      keyframes: {
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to:   { transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'slide-in-left': 'slide-in-left 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in':       'fade-in 300ms ease-out both',
        'fade-up':       'fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in':      'scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};
