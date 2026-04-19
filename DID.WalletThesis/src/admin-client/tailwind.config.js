/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        eu: {
          blue: '#003399',
          'blue-dark': '#002277',
          'blue-light': '#1a4db3',
          gold: '#FFCC00',
          'gold-dark': '#e6b800',
        },
      },
    },
  },
  plugins: [],
};