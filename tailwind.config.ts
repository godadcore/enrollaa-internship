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
        enrollaa: {
          navy: "#0F0040",
          "navy-light": "#151152",
          "navy-card": "rgba(15, 0, 64, 0.78)",
          dark: "#0F0040",
          "dark-input": "#100640",
          green: "#37E915",
          "green-hover": "#2FD110",
          "green-glow": "rgba(55, 233, 21, 0.15)",
          purple: "#7C3AED",
          amber: "#F59E0B",
          red: "#EF4444",
          "muted-light": "#A5ADCF",
          "muted-dark": "#5C6A8D",
          white: "#FFFFFF",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "Mina", "Syne", "sans-serif"],
        body: ["var(--font-body)", "DM Sans", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "16px",
        lg: "24px",
        pill: "9999px",
      },
      boxShadow: {
        "green-glow": "0 8px 25px rgba(55, 233, 21, 0.25)",
        "card-glow": "0 20px 40px rgba(15, 0, 64, 0.4)",
        "modal-glow": "0 30px 60px rgba(0, 0, 0, 0.6)",
      },
      animation: {
        "pulse-subtle": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2s infinite linear",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
