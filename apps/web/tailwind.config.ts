import type { Config } from "tailwindcss";

// Tailwind CSS v4 is primarily configured in CSS (see src/app/globals.css).
// This file exists for editor IntelliSense and to declare the dark-mode
// strategy and content sources explicitly.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
