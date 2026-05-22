/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Japanese-garden palette. Token keys preserved (cream/pink/mint/sky/butter)
      // so existing class references don't need renaming — only the hex values shift.
      // Semantic mapping:
      //   cream  -> washi paper (page bg + light surfaces)
      //   ink    -> sumi (charcoal-green text)
      //   pink   -> sakura (used sparingly as accent)
      //   mint   -> matcha (primary action green)
      //   sky    -> moss (depth / secondary surfaces; cooler than matcha)
      //   butter -> yuzu (warm gold highlight)
      colors: {
        cream: {
          DEFAULT: "#f5f0e1",
          50: "#faf6e8",
          100: "#f5f0e1",
          200: "#ede4cc",
          300: "#e0d4b8",
        },
        ink: {
          DEFAULT: "#2e3a2c",
          soft: "#4e5a4a",
          mute: "#7a8676",
        },
        pink: {
          50: "#fbe5ea",
          100: "#f8d4dc",
          200: "#f4c0cc",
          300: "#f0acba",
          500: "#d97a8d",
        },
        mint: {
          100: "#e3eed7",
          200: "#c9dcb0",
          300: "#a8c489",
          500: "#7ba05b",
        },
        sky: {
          100: "#dde5d6",
          200: "#bccab2",
          300: "#8aa07d",
          500: "#4e6a4a",
        },
        butter: {
          100: "#f4e7b6",
          200: "#ecd58a",
          300: "#e8c34a",
        },
      },
      fontFamily: {
        display: ['"Yusei Magic"', "system-ui"],
        body: ['"Klee One"', "Georgia", "serif"],
        pixel: ['"Pixelify Sans"', "monospace"],
      },
      boxShadow: {
        sticker: "2px 3px 0 0 rgba(46,58,44,0.35)",
        pop: "0 2px 0 0 #2e3a2c",
        deep: "4px 6px 0 0 rgba(46,58,44,0.45)",
      },
      animation: {
        bob: "bob 1800ms ease-in-out infinite",
        wiggle: "wiggle 1200ms ease-in-out infinite",
        blink: "blink 4200ms infinite",
        breathe: "breathe 6000ms ease-in-out infinite",
      },
      keyframes: {
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-2deg)" },
          "50%": { transform: "rotate(2deg)" },
        },
        blink: {
          "0%, 92%, 100%": { transform: "scaleY(1)" },
          "94%, 96%": { transform: "scaleY(0.06)" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.02)" },
        },
      },
    },
  },
  plugins: [],
};
