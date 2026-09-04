import { useState } from "react";
import { useApi } from "./lib";
import {
  BatchPanel,
  LearnPanel,
  ExceptionsPanel,
  ChurnPanel,
  OutcomeModelPanel,
  AuditPanel,
} from "./panels";

const LOOP = [
  { k: "detect", who: "W" },
  { k: "act", who: "R" },
  { k: "audit", who: "·" },
  { k: "reconcile", who: "W" },
  { k: "learn", who: "F1" },
];
const N_OPTIONS = [100, 200, 500, 1000, 2000];

// Tijori — Recovery Terminal. One (seed, n) control drives every panel; each is a
// deterministic projection of one scored ledger, so the whole board is reproducible.
export default function App() {
  const [seed, setSeed] = useState(42);
  const [n, setN] = useState(500);
  const [draftSeed, setDraftSeed] = useState("42");
  const health = useApi("/health", []);

  const apply = () => {
    const s = parseInt(draftSeed, 10);
    if (!Number.isNaN(s)) setSeed(s);
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* Terminal header */}
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-money/40 bg-money/10 font-mono text-sm font-bold text-money">
              ₹
            </span>
            <div>
              <h1 className="text-[15px] font-semibold leading-tight tracking-tight text-ink">
                Tijori <span className="font-normal text-faint">Recovery Terminal</span>
              </h1>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">
                Track 3 · Revenue Recovery
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5">
              <label htmlFor="seed" className="font-mono text-[10.5px] uppercase tracking-wide text-faint">seed</label>
              <input
                id="seed"
                value={draftSeed}
                onChange={(e) => setDraftSeed(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && apply()}
                inputMode="numeric"
                className="w-12 bg-transparent text-center font-mono text-sm tabular-nums text-ink outline-none"
              />
            </div>

            <div className="flex overflow-hidden rounded-lg border border-line bg-surface">
              {N_OPTIONS.map((v) => (
                <button
                  key={v}
                  onClick={() => setN(v)}
                  aria-pressed={n === v}
                  className={`px-2.5 py-1.5 font-mono text-xs tabular-nums transition-colors ${
                    n === v ? "bg-money/15 text-money" : "text-faint hover:text-muted"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <button
              onClick={apply}
              className="rounded-lg border border-money/40 bg-money/15 px-3.5 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-money transition-colors hover:bg-money/25"
            >
              run
            </button>

            <span
              className={`ml-0.5 h-2 w-2 rounded-full ${health.data ? "bg-money shadow-[0_0_8px] shadow-money/60" : "bg-rose"}`}
              title={health.data ? `API ${health.data.version}` : "API offline"}
            />
          </div>
        </div>

        {/* The loop spine */}
        <div className="mx-auto hidden max-w-6xl items-center gap-1 px-5 pb-2.5 sm:flex">
          {LOOP.map((step, i) => (
            <div key={step.k} className="flex items-center gap-1">
              <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-muted">
                <span className="text-faint">{step.who}</span>
                {step.k}
              </span>
              {i < LOOP.length - 1 && <span className="mx-1.5 text-line">→</span>}
            </div>
          ))}
          <span className="ml-2 text-line">↻</span>
          <span className="font-mono text-[10.5px] text-faint">recovered ₹ re-reconciles &amp; recalibrates</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-5 py-6">
        <BatchPanel seed={seed} n={n} />
        <LearnPanel seed={seed} n={n} delay={60} />
        <div className="grid gap-4 lg:grid-cols-2">
          <ExceptionsPanel seed={seed} n={n} delay={120} />
          <ChurnPanel seed={seed} n={n} delay={160} />
        </div>
        <OutcomeModelPanel delay={200} />
        <AuditPanel seed={seed} n={n} delay={240} />

        <footer className="border-t border-line-soft pt-5 text-center font-mono text-[10.5px] leading-relaxed text-faint">
          Same seed → byte-identical scored output · honest simulation, never claimed production<br className="sm:hidden" />
          <span className="hidden sm:inline"> · </span>
          reason taxonomy cited · WORLD/BELIEF success probabilities modeled and declared
        </footer>
      </main>
    </div>
  );
}
