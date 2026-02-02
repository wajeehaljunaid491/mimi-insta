/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f7ff',
          100: '#ebefff',
          200: '#d6dfff',
          300: '#b3c2ff',
          400: '#8c9eff',
          500: '#667eea',
          600: '#4c63d2',
          700: '#3b4fb8',
          800: '#2d3e94',
          900: '#233170',
        },
        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#764ba2',
          700: '#6b21a8',
          800: '#581c87',
          900: '#4a1772',
        },
      },
    },
  },
  plugins: [],
}
