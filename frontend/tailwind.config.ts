import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        background: 'var(--bg)',
        foreground: 'var(--text-primary)',
        card: 'var(--bg-card)',
        border: 'var(--border)',
        primary: 'var(--accent)',
      }
    },
  },
  plugins: [],
};

export default config;
