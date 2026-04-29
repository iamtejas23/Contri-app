/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#143334',
        sand: '#f7f1e3',
        coral: '#ee6c4d',
        teal: '#2a9d8f',
        mint: '#89c8b5',
        dusk: '#214244',
        cream: '#fffaf1',
      },
      boxShadow: {
        float: '0 20px 60px rgba(20, 51, 52, 0.12)',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        mesh:
          'radial-gradient(circle at top left, rgba(238, 108, 77, 0.16), transparent 30%), radial-gradient(circle at top right, rgba(42, 157, 143, 0.18), transparent 36%), linear-gradient(180deg, rgba(255, 250, 241, 0.98), rgba(247, 241, 227, 0.92))',
      },
    },
  },
  plugins: [],
}
