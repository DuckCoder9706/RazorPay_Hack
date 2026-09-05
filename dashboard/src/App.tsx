import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, GraduationCap, HelpCircle, IndianRupee, Link2, ScanSearch, ScrollText, ShieldCheck, TrendingUp } from "lucide-react";
import { useApi } from "./lib";
import type { HealthResponse } from "./types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BatchPanel,
  InsightCard,
  RecoveryFlowPanel,
  LearnPanel,
  ExceptionsPanel,
  ChurnPanel,
  OutcomeModelPanel,
  AuditPanel,
  RazorpayPanel,
  VerifyPanel,
} from "./panels";

const LOOP = [
  { k: "detect", who: "W" },
  { k: "act", who: "R" },
  { k: "audit", who: "·" },
  { k: "reconcile", who: "W" },
  { k: "learn", who: "F1" },
];
const N_OPTIONS = [100, 200, 500, 1000, 2000];

const GLOSSARY = [
  { term: "R", def: "Recover — the actuator: diagnoses cause, picks the optimal retry timing under a net-value objective, acts." },
  { term: "W", def: "Where's my money — the sensor: 3-way reconciles settlement ↔ bank ↔ orders, emits typed exceptions, and teaches R." },
  { term: "F1", def: "Reconciliation as ground truth — realized outcomes recalibrate R's BELIEF; the mis-set arm flips back to optimal." },
  { term: "F2", def: "Regret vs a distributional oracle — efficiency = policy ₹ / reachable-maximum ₹." },
  { term: "F3", def: "Cost/churn-aware net value — smart may stop earlier than a success-maximiser; robust across a churn sweep." },
  { term: "oracle", def: "Clairvoyant-timing ceiling under the true WORLD probabilities — the reachable maximum ₹." },
  { term: "baseline", def: "Razorpay's own cited default: fixed T+1 / T+2 / T+3 retries, cause-blind." },
  { term: "cause", def: "8 causes collapsed from Razorpay's 109 documented error reasons (e.g. insufficient_funds, issuer_soft_decline)." },
  { term: "timing", def: "fast (minutes–hours) · short (~T+1) · aligned (payday / limit reset)." },
  { term: "seed", def: "One integer threads all randomness; the same seed → byte-identical scored output." },
];

const TABS = [
  { v: "overview", label: "Overview" },
  { v: "recover", label: "Recover · R" },
  { v: "reconcile", label: "Reconcile · W" },
  { v: "learn", label: "Learn · F1" },
  { v: "live", label: "Live · ₹" },
  { v: "verify", label: "Verify" },
  { v: "ledger", label: "Ledger" },
];

// A shareable, reproducible view lives entirely in the URL (?seed=&n=&tab=).
function readUrl() {
  const p = new URLSearchParams(window.location.search);
  const seed = parseInt(p.get("seed") ?? "", 10);
  const n = parseInt(p.get("n") ?? "", 10);
  const tab = p.get("tab") ?? "overview";
  return {
    seed: Number.isNaN(seed) ? 42 : seed,
    n: N_OPTIONS.includes(n) ? n : 500,
    tab: TABS.some((t) => t.v === tab) ? tab : "overview",
  };
}

export default function App() {
  const init = readUrl();
  const [seed, setSeed] = useState(init.seed);
  const [n, setN] = useState(init.n);
  const [draftSeed, setDraftSeed] = useState(String(init.seed));
  const [tab, setTab] = useState(init.tab);
  const [runId, setRunId] = useState(0);
  const [copied, setCopied] = useState(false);
  const health = useApi<HealthResponse>("/health", []);

  // Keep the URL in sync so the exact view is a permalink.
  useEffect(() => {
    const p = new URLSearchParams();
    p.set("seed", String(seed));
    p.set("n", String(n));
    p.set("tab", tab);
    window.history.replaceState(null, "", `?${p.toString()}`);
  }, [seed, n, tab]);

  const apply = () => {
    const s = parseInt(draftSeed, 10);
    if (!Number.isNaN(s)) setSeed(s);
    setRunId((r) => r + 1); // replay the streamed playback even if the seed is unchanged
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
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
              <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">Track 3 · Revenue Recovery</p>
            </div>
          </div>

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
                    n === v ? "bg-money/15 text-money" : "text-faint hover:text-dim"
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

            <button
              onClick={copyLink}
              title="Copy a permalink to this exact view"
              className="grid h-[30px] w-[30px] place-items-center rounded-lg border border-line bg-surface text-faint transition-colors hover:text-dim"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-money" /> : <Link2 className="h-3.5 w-3.5" />}
            </button>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  title="Glossary"
                  className="grid h-[30px] w-[30px] place-items-center rounded-lg border border-line bg-surface text-faint transition-colors hover:text-dim"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="max-h-[70vh] w-80 overflow-auto border border-line bg-raised text-xs shadow-panel">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-faint">glossary</p>
                <dl className="space-y-2">
                  {GLOSSARY.map((g) => (
                    <div key={g.term} className="grid grid-cols-[70px_1fr] gap-2">
                      <dt className="font-mono font-medium text-money">{g.term}</dt>
                      <dd className="leading-relaxed text-dim">{g.def}</dd>
                    </div>
                  ))}
                </dl>
              </PopoverContent>
            </Popover>

            <span
              className={`ml-0.5 h-2 w-2 rounded-full ${health.data ? "bg-money shadow-[0_0_8px] shadow-money/60" : "bg-rose"}`}
              title={health.data ? `API ${health.data.version}` : "API offline"}
            />
          </div>
        </div>

        <div className="mx-auto hidden max-w-6xl items-center gap-1 px-5 pb-2.5 sm:flex">
          {LOOP.map((step, i) => (
            <div key={step.k} className="flex items-center gap-1">
              <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-dim">
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

      <main className="mx-auto max-w-6xl px-5 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 h-auto flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="rounded-lg px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-faint data-[state=active]:bg-money/15 data-[state=active]:text-money data-[state=active]:shadow-none"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-4 focus-visible:outline-none">
            <BatchPanel seed={seed} n={n} runId={runId} />
            <div className="grid gap-4 lg:grid-cols-2">
              <InsightCard seed={seed} n={n} delay={60} />
              <div className="grid gap-3 sm:grid-cols-2">
                <DrawerTile icon={ScanSearch} title="Reconcile · W" desc="3-way exceptions + netting" tint="text-sky">
                  <ExceptionsPanel seed={seed} n={n} />
                </DrawerTile>
                <DrawerTile icon={GraduationCap} title="Learn · F1" desc="belief recalibrates, regret → 0" tint="text-money">
                  <LearnPanel seed={seed} n={n} />
                </DrawerTile>
                <DrawerTile icon={TrendingUp} title="Churn · F3" desc="net-value ranking is robust" tint="text-amber">
                  <ChurnPanel seed={seed} n={n} />
                </DrawerTile>
                <DrawerTile icon={IndianRupee} title="Live · Razorpay" desc="real test-mode link" tint="text-money">
                  <RazorpayPanel />
                </DrawerTile>
                <DrawerTile icon={ShieldCheck} title="Verify" desc="reproducible · bounded" tint="text-money">
                  <VerifyPanel seed={seed} n={n} />
                </DrawerTile>
                <DrawerTile icon={ScrollText} title="Ledger" desc="append-only audit" tint="text-dim">
                  <AuditPanel seed={seed} n={n} />
                </DrawerTile>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="recover" className="mt-0 space-y-4 focus-visible:outline-none">
            <BatchPanel seed={seed} n={n} runId={runId} />
            <RecoveryFlowPanel seed={seed} n={n} delay={60} />
            <ChurnPanel seed={seed} n={n} delay={120} />
          </TabsContent>

          <TabsContent value="reconcile" className="mt-0 space-y-4 focus-visible:outline-none">
            <ExceptionsPanel seed={seed} n={n} />
            <OutcomeModelPanel delay={60} />
          </TabsContent>

          <TabsContent value="learn" className="mt-0 focus-visible:outline-none">
            <LearnPanel seed={seed} n={n} />
          </TabsContent>

          <TabsContent value="live" className="mt-0 focus-visible:outline-none">
            <RazorpayPanel />
          </TabsContent>

          <TabsContent value="verify" className="mt-0 focus-visible:outline-none">
            <VerifyPanel seed={seed} n={n} />
          </TabsContent>

          <TabsContent value="ledger" className="mt-0 focus-visible:outline-none">
            <AuditPanel seed={seed} n={n} />
          </TabsContent>
        </Tabs>

        <footer className="mt-6 border-t border-line-soft pt-5 text-center font-mono text-[10.5px] leading-relaxed text-faint">
          Same seed → byte-identical scored output · honest simulation, never claimed production
          <br className="sm:hidden" />
          <span className="hidden sm:inline"> · </span>
          reason taxonomy cited · WORLD/BELIEF success probabilities modeled and declared
        </footer>
      </main>
    </div>
  );
}

function DrawerTile({
  icon: Icon,
  title,
  desc,
  tint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  tint: string;
  children: ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="group flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-soft hover:bg-raised/60">
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tint}`} strokeWidth={1.8} />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">{title}</span>
            <span className="mt-0.5 block text-xs leading-snug text-faint">{desc}</span>
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto border-line bg-canvas p-4 sm:max-w-xl">
        {children}
      </SheetContent>
    </Sheet>
  );
}
