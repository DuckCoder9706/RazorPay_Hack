/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Ink canvas — near-black with a cool cast, panels a step lighter.
        canvas: "#0a0c10",
        surface: "#12151c",
        raised: "#171b24",
        line: "#232833", // hairline dividers / panel borders (≥3:1 on canvas)
        "line-soft": "#1b1f28",
        // Text
        ink: "#e7eaf0", // primary
        muted: "#9aa3b2", // secondary (~7:1 on surface)
        faint: "#7d8798", // meta (~4.6:1 on surface)
        // Signals — each has ONE job.
        money: "#34d399", // recovered / smart / positive (the scarce green)
        "money-dim": "#10b981",
        azure: "#6ea8fe", // structure / oracle / links
        amber: "#f5b544", // Razorpay's cited baseline (the "old way")
        rose: "#fb7185", // regret / missing / negative
        violet: "#a78bfa", // timing exceptions
        sky: "#56ccf2", // fee exceptions
      },
      boxShadow: {
        // Soft ambient elevation for the hero only — the rest use hairlines.
        panel: "0 1px 0 0 rgba(255,255,255,0.02) inset, 0 8px 30px -12px rgba(0,0,0,0.6)",
      },
      letterSpacing: {
        tighter2: "-0.04em",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        grow: {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};
