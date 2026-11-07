import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /** Warm cream page canvas. */
        paper: "#F3F3EE",
        /** Slightly brighter surface for panels. */
        paperAlt: "#FAFAF8",
        /** Recessed sand tone for wells and disabled fills. */
        sand: "#E8E8DE",
        /** Warm charcoal ink. */
        ink: "#302B28",
        /** Muted copy. */
        inkSoft: "#69695D",
        /** Hairline divider. */
        line: "#CECEBF",
        brand: {
          DEFAULT: "#F43E01",
          deep: "#C93300",
          tint: "#FFF0EC",
        },
      },
      fontFamily: {
        sans: [
          "Space Grotesk",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        card: "12px",
      },
      borderColor: {
        DEFAULT: "#CECEBF",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
        sweep: "sweep 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
