/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink:   'rgb(var(--color-ink) / <alpha-value>)',
        dusk:  'rgb(var(--color-dusk) / <alpha-value>)',
        sand:  'rgb(var(--color-sand) / <alpha-value>)',
        cream: 'rgb(var(--color-cream) / <alpha-value>)',
        teal:  '#0D9488',  // teal-600  — brand / primary action
        mint:  '#5EEAD4',  // teal-300  — lighter teal accent
        coral: '#F97316',  // orange-500 — CTA / danger accent
      },
      boxShadow: {
        float:    '0 1px 3px 0 rgb(0 0 0/0.08), 0 1px 2px -1px rgb(0 0 0/0.06)',
        card:     '0 4px 6px -1px rgb(0 0 0/0.06), 0 2px 4px -2px rgb(0 0 0/0.04)',
        elevated: '0 20px 25px -5px rgb(0 0 0/0.08), 0 8px 10px -6px rgb(0 0 0/0.04)',
        modal:    '0 25px 50px -12px rgb(0 0 0/0.20)',
      },
      fontFamily: {
        sans:    ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        mesh: 'linear-gradient(135deg, rgb(var(--color-cream)) 0%, rgb(var(--color-sand)) 100%)',
      },
      borderRadius: {
        card: '1rem',
      },
    },
  },
  plugins: [],
}
