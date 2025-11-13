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
      },
      keyframes: {
        ring: {
          '0%, 100%': { transform: 'rotate(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'rotate(-10deg)' },
          '20%, 40%, 60%, 80%': { transform: 'rotate(10deg)' },
        }
      },
      animation: {
        ring: 'ring 1s ease-in-out',
      }
    },
  },
  plugins: [],
};
