import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#3A7D44", // forest green — nav, buttons, active states
          orange: "#E86B3A", // sunset orange — accents, CTAs, Non-Swimmer badge
          yellow: "#F2B84B", // warm yellow — secondary accents, Beginner badge
          aqua: "#7EC8C8", // sky blue — calendar headers, aquatic elements
          cream: "#FDFAF5", // page backgrounds
          sand: "#F5EFE0", // card backgrounds
          amber: "#F5A623", // special needs callout banner
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
