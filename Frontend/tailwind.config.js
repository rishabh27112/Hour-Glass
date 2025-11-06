/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-bg': '#1b1b1b',
        'surface': '#2c2c2c',
        'surface-light': '#3a3a3a',
        'cyan': '#18d4d1',
        'cyan-light': '#a6f2f0',
        'cyan-dark': '#14a3a1',
      }
    },
  },
  plugins: [],
};
