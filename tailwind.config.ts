import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Inter",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(52, 211, 153, 0.35)" },
          "70%": { boxShadow: "0 0 0 8px rgba(52, 211, 153, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(52, 211, 153, 0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2s ease-out infinite",
      },
      boxShadow: {
        glow: "0 0 40px -12px rgba(52, 211, 153, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
