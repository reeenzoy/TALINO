/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'], // supports your html[data-theme="..."]
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // map to CSS vars so you can theme with data-theme
        bgp: 'var(--background-primary)',
        bgs: 'var(--background-secondary)',
        textp: 'var(--text-primary)',
        texts: 'var(--text-secondary)',
        borderc: 'var(--border-color)',
        accent: 'var(--accent-color)',
        error: 'var(--error-color)',
        userBubble: 'var(--chat-bubble-user-bg)',
        botBubble: 'var(--chat-bubble-bot-bg)',
        brandYellow: '#ffbe18',
        brandBlue: '#014687',
        brandRed: '#da231c',
      },
      boxShadow: {
        card: '0 2px 24px rgba(0,0,0,0.12)',
      },
      keyframes: {
        dotFade: {
          '0%,80%,100%': { opacity: '0.2' },
          '40%': { opacity: '1' },
        },
      },
      animation: {
        dotFade: 'dotFade 1s infinite',
      },
    },
  },
  plugins: [],
};
