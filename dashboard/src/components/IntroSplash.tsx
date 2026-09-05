import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

// Full-screen branded entrance. Presenter-controlled: the boot steps tick through real
// system stages, then an "Enter Dashboard" CTA reveals. Skip is always available for
// re-records. On enter it fades/scales out, then unmounts (onEnter) to reveal the app.
const STEPS = [
  "Seeding deterministic ledger",
  "Scoring recovery batch",
  "Reconciling gateway ↔ bank ↔ orders",
  "Verifying SHA-256 determinism",
];

const STEP_MS = 520; // per-step cadence

export function IntroSplash({ onEnter }: { onEnter: () => void }) {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const ready = step >= STEPS.length;

  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, ready]);

  const enter = () => {
    setLeaving(true);
    setTimeout(onEnter, 620); // match the fade-out duration below
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden text-white transition-all duration-[600ms] ease-out ${
        leaving ? "opacity-0 scale-[1.04] pointer-events-none" : "opacity-100 scale-100"
      }`}
      style={{ background: "linear-gradient(135deg, #0C2340 0%, #0C83FD 62%, #00A878 100%)" }}
      role="dialog"
      aria-label="Tijori — entering dashboard"
    >
      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/20 blur-3xl" />

      {/* Skip */}
      <button
        onClick={enter}
        className="absolute right-5 top-5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm transition-colors hover:bg-white/20"
      >
        Skip →
      </button>

      <div className="relative flex w-full max-w-md flex-col items-center px-6 text-center">
        {/* Logo mark */}
        <div
          className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 font-mono text-3xl font-bold text-white shadow-2xl ring-1 ring-inset ring-white/30 backdrop-blur-sm animate-in zoom-in-75 fade-in duration-700"
        >
          ₹
        </div>

        {/* Wordmark + tagline */}
        <h1 className="mt-5 text-4xl font-bold tracking-tight animate-in slide-in-from-bottom-2 fade-in duration-700" style={{ animationDelay: "120ms" }}>
          Tijori
        </h1>
        <p className="mt-1.5 text-sm font-medium text-white/80 animate-in fade-in duration-700" style={{ animationDelay: "260ms" }}>
          Autonomous Revenue Recovery for Razorpay
        </p>

        {/* Boot steps */}
        <ul className="mt-8 w-full space-y-2.5 text-left">
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li
                key={label}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium backdrop-blur-sm transition-all duration-300 ${
                  done
                    ? "border-white/25 bg-white/10 text-white"
                    : active
                    ? "border-white/30 bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-white/45"
                }`}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center">
                  {done ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-white/90 animate-in zoom-in duration-300">
                      <Check className="h-3 w-3 text-emerald-700" strokeWidth={3} />
                    </span>
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-white/40" />
                  )}
                </span>
                <span>{label}</span>
              </li>
            );
          })}
        </ul>

        {/* Enter CTA — appears once boot completes */}
        <div className="mt-8 h-12 w-full">
          {ready && (
            <button
              onClick={enter}
              autoFocus
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-navy shadow-2xl transition-all hover:shadow-white/20 animate-in slide-in-from-bottom-2 fade-in duration-500"
            >
              Enter Dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>

        <p className="mt-4 font-mono text-[11px] text-white/55 animate-in fade-in duration-700" style={{ animationDelay: "400ms" }}>
          Deterministic · Cited · Byte-verifiable
        </p>
      </div>
    </div>
  );
}
