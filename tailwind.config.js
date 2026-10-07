/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Paleta clara: azul vivo para ações e destaques, fundos quase brancos e texto em cinza-azulado
      // (antes: primary #000f23 / menu #0f253e / texto #0b1c30, quase pretos).
      colors: {
        primary: '#2563eb',
        'primary-hover': '#1d4ed8',
        'primary-container': '#dbeafe',
        'on-primary': '#ffffff',
        'on-primary-container': '#1e40af',

        secondary: '#0d9488',
        'secondary-container': '#ccfbf1',
        'on-secondary-container': '#0f766e',

        error: '#dc2626',
        'error-container': '#fee2e2',
        'on-error': '#ffffff',
        'on-error-container': '#991b1b',

        background: '#f4f7fc',
        surface: '#f4f7fc',
        'surface-bright': '#ffffff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f1f5fb',
        'surface-container': '#e8eef8',
        'surface-container-high': '#dde7f5',
        'surface-variant': '#e2eaf6',

        'on-surface': '#334155',
        'on-surface-variant': '#475569',
        outline: '#64748b',
        'outline-variant': '#cbd5e1',
      },
      borderRadius: { DEFAULT: '0.125rem', lg: '0.25rem', xl: '0.5rem', full: '0.75rem' },
      spacing: {
        'space-xs': '0.25rem',
        'space-xl': '2rem',
        gutter: '1rem',
        'space-sm': '0.5rem',
        'space-md': '0.75rem',
        'space-lg': '1.25rem',
        margin: '1.5rem',
      },
      fontFamily: {
        'body-md': ['Inter', 'sans-serif'],
        'headline-lg': ['Inter', 'sans-serif'],
        'headline-sm': ['Inter', 'sans-serif'],
        'display-lg': ['Inter', 'sans-serif'],
        'data-mono': ['JetBrains Mono', 'monospace'],
        'label-md': ['Inter', 'sans-serif'],
        'body-sm': ['Inter', 'sans-serif'],
        'label-sm': ['Inter', 'sans-serif'],
      },
      fontSize: {
        'body-md': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'headline-lg': ['24px', { lineHeight: '32px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'headline-sm': ['18px', { lineHeight: '26px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'display-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'data-mono': ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.02em', fontWeight: '600' }],
        'body-sm': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.04em', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
}
