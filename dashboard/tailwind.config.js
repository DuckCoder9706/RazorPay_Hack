import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        // --- Light "product" palette (authoritative; each token has one job) ------
        // Soft off-white canvas, white cards, readable signals (each ≥4.4:1 on white
        // so it works as text AND as a fill). Deeper than neon = calm/premium.
        canvas: "#edeef1", // page ground (soft gray)
        surface: "#ffffff", // cards
        raised: "#f5f6f8", // insets / hovers
        line: "#e4e7ec", // hairline borders
        "line-soft": "#eef0f3",
        ink: "#1a1d23", // primary text
        dim: "#565e6b", // secondary text (~7:1)
        faint: "#737b88", // meta text (~4.6:1)
        money: "#167c3c",
        "money-dim": "#0f6a30",
        azure: "#2563eb",
        amber: "#c2740c",
        rose: "#e11d48",
        violet: "#7c3aed",
        sky: "#0284c7",
        // --- shadcn/ui semantic set (CSS vars → mapped onto the palette) ----------
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        // Soft, Zentra-style elevation on white.
        card: "0 1px 2px rgba(16,24,40,0.04), 0 6px 16px -8px rgba(16,24,40,0.10)",
        panel: "0 1px 3px rgba(16,24,40,0.06), 0 12px 32px -12px rgba(16,24,40,0.16)",
      },
      letterSpacing: { tighter2: "-0.04em" },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
