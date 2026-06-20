import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette sampled directly from the Country Day Camp logo.
        brand: {
          green: "#407A5B", // forest green ring & script — nav, buttons, active states
          orange: "#EC744F", // sunset orange — accents, CTAs, Non-Swimmer badge
          yellow: "#F2C75A", // warm sun yellow — secondary accents, Beginner badge
          aqua: "#648EAA", // logo water (deeper wave) — calendar headers, aquatic elements
          aqualight: "#9CBAD2", // logo water (lighter wave) — header gradient top
          cream: "#FDFAF5", // page backgrounds
          sand: "#F5EFE0", // card backgrounds
          amber: "#EFA45C", // warm amber (mid-sun) — special needs callout banner
          text: "#2C2C2C", // primary text
        },
      },
      fontFamily: {
        display: ["Pacifico", "cursive"],
        body: ["Nunito", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
