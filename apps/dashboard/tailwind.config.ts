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
          dark: '#8F432B',
        },
        clay: {
          DEFAULT: '#71382D',
          hover: '#5E2E25',
        },
        sand: {
          DEFAULT: '#E5D4BC',
          light: '#F0E5D4',
        },
        ink: '#191816',
        line: '#E8E2DA',
        muted: '#7A7267',
      },
      fontFamily: {
        sans: [
          'Poppins',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        serif: [
          'Poppins',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
