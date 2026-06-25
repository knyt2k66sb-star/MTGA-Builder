/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mtg: {
          w: '#f8f6d8',
          u: '#aae0fa',
          b: '#cbc2bf',
          r: '#f9aa8f',
          g: '#9bd3ae',
          c: '#cac5c0',
        },
      },
    },
  },
  plugins: [],
};
