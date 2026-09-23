import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ivory: '#FFFFFF',
        terracotta: {
          DEFAULT: '#B85C3E',
          hover: '#A34F33',
        },
        clay: '#71382D',
        sand: '#E5D4BC',
        ink: '#191816',
        line: '#E8E2DA',
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
