/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0B6E4F',
        accent: '#E8B317',
        danger: '#C62828',
      }
    },
  },
  plugins: [],
}