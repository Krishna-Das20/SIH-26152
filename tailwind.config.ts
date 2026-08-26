import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        nexus: {
          bg: "#0A0A0B",
          surface: "#111113",
          "surface-secondary": "#151517",
          border: "#242426",
          "text-primary": "#F5F5F5",
          "text-secondary": "#8A8A8F",
          muted: "#5F5F65",
          accent: "#D8C7A3",
          "accent-steel": "#7F8C9A",
          positive: "#7FA88A",
          negative: "#A87878",
          warning: "#B49A68",
        },
        // Keep legacy colors for any old components that haven't been migrated
        intel: {
          dark: "#0a0d14",
          card: "#111726",
          border: "#1e293b",
          cyan: "#00f0ff",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#f43f5e",
          purple: "#a855f7",
        },
      },
      fontFamily: {
        sans: [
          "Geist",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "Geist Mono",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
