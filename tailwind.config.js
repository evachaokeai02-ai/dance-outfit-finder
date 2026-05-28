/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 18px 45px rgba(244, 114, 182, 0.14)',
        card: '0 10px 28px rgba(31, 41, 55, 0.08)',
      },
      colors: {
        ink: '#2f2a32',
        cream: '#fffaf5',
        blush: '#fff1f2',
        rose: '#fb7185',
        mint: '#99f6e4',
        lemon: '#fde68a',
        lilac: '#ddd6fe',
      },
    },
  },
  plugins: [],
};
