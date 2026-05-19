import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#185FA5",
          50: "#E8F0F9",
          100: "#C7DCEF",
          500: "#185FA5",
          600: "#114B85",
          700: "#0B3866",
        },
        neutral: {
          50: "#F8F7F4",
          100: "#EDEBE5",
          200: "#D3D1C7",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
