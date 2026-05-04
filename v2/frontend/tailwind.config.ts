import type { Config } from "tailwindcss";

/**
 * Tailwind tokens reference CSS custom properties defined in src/index.css.
 * The CSS variables themselves mirror the GammaLedger v1 design tokens
 * (see src/style.css in the legacy app) so the visual identity is preserved.
 */
const config: Config = {
  darkMode: ["class", '[data-color-scheme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-primary-foreground)",
        },
        text: {
          DEFAULT: "var(--color-text)",
          secondary: "var(--color-text-secondary)",
        },
        success: "var(--color-success)",
        error: "var(--color-error)",
        warning: "var(--color-warning)",
        info: "var(--color-info)",
        "trend-up": "var(--color-trend-up)",
        "trend-down": "var(--color-trend-down)",
        "brand-purple": "var(--color-brand-purple)",
      },
      fontFamily: {
        sans: ["Inter", "Roboto", "system-ui", "sans-serif"],
        mono: ["Berkeley Mono", "ui-monospace", "Menlo", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
    },
  },
  plugins: [],
};

export default config;
