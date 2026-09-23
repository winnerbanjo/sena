import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ivory: '#F7F1E8',
        terracotta: {
          DEFAULT: '#B85C3E',
          hover: '#A34F33',
        },
        clay: '#71382D',
        sand: '#E5D4BC',
        ink: '#191816',
        line: '#E2D8CC',
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
