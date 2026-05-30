/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['selector', '.app-dark'],
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6ff',
          200: '#bdd1ff',
          300: '#94b1ff',
          400: '#6987ff',
          500: '#4361ff',
          600: '#2f44e6',
          700: '#2434b8',
          800: '#1f2d92',
          900: '#1d2974',
          950: '#141a47'
        },
        surface: {
          0: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.06)',
        card: '0 4px 12px -2px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
        glow: '0 0 0 4px rgba(67, 97, 255, 0.12)'
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem'
      }
    }
  },
  plugins: [require('tailwindcss-primeui')]
};
