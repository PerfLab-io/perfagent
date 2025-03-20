import type { Config } from "tailwindcss";
const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        merino: {
          "50": "var(--merino-50)",
          "100": "var(--merino-100)",
          "200": "var(--merino-200)",
          "300": "var(--merino-300)",
          "400": "var(--merino-400)",
          "500": "var(--merino-500)",
          "600": "var(--merino-600)",
          "700": "var(--merino-700)",
          "800": "var(--merino-800)",
          "900": "var(--merino-900)",
          "950": "var(--merino-950)",
        },
        peppermint: {
          "25": "var(--peppermint-25)",
          "50": "var(--peppermint-50)",
          "100": "var(--peppermint-100)",
          "200": "var(--peppermint-200)",
          "300": "var(--peppermint-300)",
          "400": "var(--peppermint-400)",
          "500": "var(--peppermint-500)",
          "600": "var(--peppermint-600)",
          "700": "var(--peppermint-700)",
          "800": "var(--peppermint-800)",
          "900": "var(--peppermint-900)",
          "950": "var(--peppermint-950)",
        },
        midnight: {
          "50": "var(--midnight-50)",
          "100": "var(--midnight-100)",
          "200": "var(--midnight-200)",
          "300": "var(--midnight-300)",
          "400": "var(--midnight-400)",
          "500": "var(--midnight-500)",
          "600": "var(--midnight-600)",
          "700": "var(--midnight-700)",
          "800": "var(--midnight-800)",
          "900": "var(--midnight-900)",
          "950": "var(--midnight-950)",
        },
        border: "var(--border)",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "var(--bg-color)",
        foreground: "var(--text-color)",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "var(--accent-color)",
          foreground: "var(--text-color)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "var(--card-bg)",
          foreground: "var(--text-color)",
        },
        base: "var(--text-color)",
      },
      backgroundColor: {
        DEFAULT: "var(--bg-color)",
      },
      textColor: {
        DEFAULT: "var(--text-color)",
      },
      borderColor: {
        DEFAULT: "var(--border-color)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
