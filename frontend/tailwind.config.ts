import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#f7f9ff',
        surface: '#eff4ff',
        panel: '#d9e7ff',
        line: 'rgba(129,149,188,0.18)',
        ink: '#0d1b33',
        muted: '#6d7b95',
        primary: '#1151ff',
        'primary-deep': '#003ec7',
        tertiary: '#0a607f',
        navy: '#263851',
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)'],
        body: ['var(--font-manrope)'],
      },
      boxShadow: {
        panel: '0 28px 48px rgba(13, 27, 51, 0.08)',
        float: '0 24px 34px rgba(17, 81, 255, 0.16)',
      },
      backgroundImage: {
        'hero-fade':
          'radial-gradient(circle at top left, rgba(17, 81, 255, 0.07), transparent 30%), linear-gradient(180deg, #fbfcff 0%, #f7f9ff 100%)',
        'button-primary':
          'linear-gradient(135deg, #003ec7 0%, #1151ff 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
