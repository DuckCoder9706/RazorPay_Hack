import { useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { GraduationCap, ScanSearch, ScrollText, TrendingUp } from "lucide-react";
import { useApi } from "./lib";
import type { HealthResponse } from "./types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  BatchPanel,
  RecoveryFlowPanel,
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

const TABS = [
  { v: "overview", label: "Overview" },
  { v: "recover", label: "Recover · R" },
  { v: "reconcile", label: "Reconcile · W" },
  { v: "learn", label: "Learn · F1" },
  { v: "ledger", label: "Ledger" },
];

export default function App() {
  const [seed, setSeed] = useState(42);
  const [n, setN] = useState(500);
  const [draftSeed, setDraftSeed] = useState("42");
  const [tab, setTab] = useState("overview");
  const [runId, setRunId] = useState(0);
  const health = useApi<HealthResponse>("/health", []);

  const apply = () => {
    const s = parseInt(draftSeed, 10);
    if (!Number.isNaN(s)) setSeed(s);
    setRunId((r) => r + 1); // replay the streamed playback even if the seed is unchanged
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DrawerTile icon={ScanSearch} title="Reconcile · W" desc="3-way exceptions + netting" tint="text-sky">
                <ExceptionsPanel seed={seed} n={n} />
              </DrawerTile>
              <DrawerTile icon={GraduationCap} title="Learn · F1" desc="belief recalibrates, regret → 0" tint="text-money">
                <LearnPanel seed={seed} n={n} />
              </DrawerTile>
              <DrawerTile icon={TrendingUp} title="Churn · F3" desc="net-value ranking is robust" tint="text-amber">
                <ChurnPanel seed={seed} n={n} />
              </DrawerTile>
              <DrawerTile icon={ScrollText} title="Ledger" desc="append-only audit trail" tint="text-dim">
                <AuditPanel seed={seed} n={n} />
              </DrawerTile>
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
