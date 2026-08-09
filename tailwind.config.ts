import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: token("bg"),
        panel: token("panel"),
        sunken: token("sunken"),
        line: { DEFAULT: token("line"), strong: token("line-strong") },
        body: token("text"),
        muted: token("muted"),
        dim: token("dim"),
        accent: { DEFAULT: token("accent"), ink: token("accent-ink") },
        target: token("target"),
        pass: token("pass"),
        avoid: token("avoid"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.01em" }],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
