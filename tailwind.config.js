/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        serif: ['"EB Garamond"', 'Georgia', 'serif'],
      },
      colors: {
        // Dark wood / leather chrome
        wood: {
          950: '#140d07',
          900: '#1c140d',
          800: '#2a1d10',
          700: '#3a2916',
          600: '#4a351d',
        },
        // Aged parchment surfaces & text
        parchment: {
          100: '#f3ead2',
          200: '#e8dcc0',
          300: '#d9c9a3',
          400: '#b7a47e',
          500: '#8f7d5b',
        },
        // Gold / bronze bevel accents
        gold: {
          300: '#e9cd7a',
          400: '#d8b24c',
          500: '#c9a44c',
          600: '#b3893a',
          700: '#8a6d3b',
          800: '#5e4a28',
        },
        ink: '#2b2118',
        // MTG mana identity (kept, framed in gold)
        mtg: {
          w: '#f8f6d8',
          u: '#aae0fa',
          b: '#cbc2bf',
          r: '#f9aa8f',
          g: '#9bd3ae',
          c: '#cac5c0',
        },
      },
      boxShadow: {
        bevel: 'inset 0 1px 0 0 rgba(233,205,122,0.25), inset 0 0 0 1px rgba(138,109,59,0.4), 0 2px 6px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
