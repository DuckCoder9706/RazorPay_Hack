import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Check,
  GraduationCap,
  HelpCircle,
  IndianRupee,
  LayoutDashboard,
  Link2,
  Network,
  ScanSearch,
  ScrollText,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useApi } from "./lib";
import type { HealthResponse } from "./types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BatchPanel,
  InsightCard,
  RecoveryFlowPanel,
  SankeyPanel,
  LearnPanel,
  ExceptionsPanel,
  ChurnPanel,
  OutcomeModelPanel,
  AuditPanel,
  RazorpayPanel,
  VerifyPanel,
  PipelinePanel,
  PipelineSummaryCard,
} from "./panels";

const N_OPTIONS = [100, 200, 500, 1000, 2000];

const GLOSSARY = [
  { term: "R (Recover)", def: "Actuator: diagnoses causes and optimizes retry timing for max recovery." },
  { term: "W (Reconcile)", def: "Sensor: 3-way reconciles settlement, bank, and orders to emit exceptions." },
  { term: "F1 (Learn)", def: "Closed loop: realized outcomes recalibrate probability beliefs." },
  { term: "F2 (Efficiency)", def: "Recovered revenue ratio relative to theoretical upper bound." },
  { term: "F3 (Net Value)", def: "Objective function net of operational and customer churn costs." },
  { term: "Upper Bound", def: "Clairvoyant upper bound of recoverable revenue under true probabilities." },
  { term: "Baseline", def: "Razorpay's cited default fixed T+1 / T+2 / T+3 retry pattern." },
  { term: "Deterministic", def: "Identical seed produces 100% byte-identical scored ledger outcomes." },
];

const TABS = [
  { v: "overview", label: "Overview", icon: LayoutDashboard },
  { v: "live", label: "Live Sandbox", icon: Zap, highlight: true },
  { v: "pipeline", label: "Data Ingestion", icon: Network },
  { v: "recover", label: "Recovery Engine", icon: IndianRupee },
  { v: "reconcile", label: "3-Way Recon", icon: ScanSearch },
  { v: "learn", label: "Adaptive Learning", icon: GraduationCap },
  { v: "verify", label: "Verification", icon: ShieldCheck },
  { v: "ledger", label: "Audit Ledger", icon: ScrollText },
];

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
    setRunId((r) => r + 1);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Primary Clean Enterprise Header */}
      <header className="sticky top-0 z-30 border-b border-line/80 bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Brand & Badge */}
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-azure/10 text-azure font-mono text-base font-bold border border-azure/20 shadow-sm">
              ₹
            </span>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-navy">
                Tijori
              </h1>
              <span className="hidden sm:inline-flex items-center rounded-full bg-azure-light px-2.5 py-0.5 text-[11px] font-semibold text-azure border border-azure/20">
                Autonomous Revenue Recovery
              </span>
            </div>
          </div>

          {/* Controls & Tools */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Seed Input */}
            <div className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 shadow-sm">
              <label htmlFor="seed" className="font-mono text-[10px] font-semibold uppercase tracking-wider text-faint">
                seed
              </label>
              <input
                id="seed"
                value={draftSeed}
                onChange={(e) => setDraftSeed(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && apply()}
                inputMode="numeric"
                className="w-12 bg-transparent text-center font-mono text-xs font-semibold tabular-nums text-navy outline-none"
              />
            </div>

            {/* Batch Size Selector */}
            <div className="flex overflow-hidden rounded-lg border border-line bg-white shadow-sm">
              {N_OPTIONS.map((v) => (
                <button
                  key={v}
                  onClick={() => setN(v)}
                  aria-pressed={n === v}
                  className={`px-2.5 py-1.5 font-mono text-xs tabular-nums transition-colors ${
                    n === v ? "bg-azure text-white font-semibold" : "text-faint hover:text-ink hover:bg-raised"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Run Button */}
            <button
              onClick={apply}
              className="rounded-lg bg-azure hover:bg-azure-hover px-3.5 py-1.5 font-semibold text-xs text-white shadow-sm transition-all"
            >
              Run
            </button>

            {/* Copy Permalink */}
            <button
              onClick={copyLink}
              title="Copy shareable link to this exact view"
              className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white text-faint shadow-sm transition-colors hover:text-ink hover:bg-raised"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-money" /> : <Link2 className="h-3.5 w-3.5" />}
            </button>

            {/* Glossary Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  title="Architecture Glossary"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white text-faint shadow-sm transition-colors hover:text-ink hover:bg-raised"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 border border-line bg-white/95 p-4 text-xs shadow-panel backdrop-blur-md">
                <p className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-wider text-faint">
                  System Terms & Invariants
                </p>
                <dl className="space-y-2">
                  {GLOSSARY.map((g) => (
                    <div key={g.term} className="text-xs">
                      <dt className="font-semibold text-azure">{g.term}</dt>
                      <dd className="text-dim text-[11.5px] leading-snug">{g.def}</dd>
                    </div>
                  ))}
                </dl>
              </PopoverContent>
            </Popover>

            {/* Live API Status */}
            <div className="flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-xs shadow-sm">
              <span
                className={`h-2 w-2 rounded-full ${
                  health.data ? "bg-money animate-pulse shadow-[0_0_8px] shadow-money/60" : "bg-rose"
                }`}
              />
              <span className="font-mono text-[11px] font-medium text-dim">
                {health.data ? "Live API" : "Offline"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-5 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          {/* Elevated Glassmorphic Floating Tab Bar */}
          <TabsList className="mb-6 flex w-full flex-wrap items-center gap-1.5 rounded-2xl border border-line/80 bg-white/90 p-1.5 shadow-sm backdrop-blur-md">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger
                  key={t.v}
                  value={t.v}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold tracking-wide transition-all data-[state=active]:bg-azure data-[state=active]:text-white data-[state=active]:shadow-md ${
                    t.highlight
                      ? "text-azure bg-azure-light/60 hover:bg-azure-light"
                      : "text-dim hover:text-ink hover:bg-raised"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                  {t.highlight && (
                    <span className="rounded bg-azure px-1.5 py-0.2 font-mono text-[9px] font-bold text-white data-[state=active]:bg-white/20 data-[state=active]:text-white">
                      LIVE
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* OVERVIEW TAB (Option A: The Split Stage) */}
          <TabsContent value="overview" className="mt-0 space-y-5 focus-visible:outline-none">
            {/* Top Stage: Recovery Performance (Left 7) + Live Sandbox Testing (Right 5) */}
            <div className="grid gap-5 lg:grid-cols-12 items-stretch">
              <div className="lg:col-span-7 flex flex-col">
                <BatchPanel seed={seed} n={n} runId={runId} />
              </div>
              <div className="lg:col-span-5 flex flex-col">
                <RazorpayPanel heroMode />
              </div>
            </div>

            {/* Ingestion Pipeline Interactive Summary Card */}
            <PipelineSummaryCard seed={seed} n={n} onNavigate={() => setTab("pipeline")} />

            {/* Lower Analytics Stage */}
            <div className="grid gap-5 lg:grid-cols-12">
              <div className="lg:col-span-5 flex">
                <InsightCard seed={seed} n={n} delay={40} />
              </div>
              <div className="lg:col-span-7 grid gap-3 sm:grid-cols-2">
                <DrawerTile icon={ScanSearch} title="3-Way Reconciliation" desc="Settlement match & exception audit" tint="text-azure">
                  <ExceptionsPanel seed={seed} n={n} />
                </DrawerTile>
                <DrawerTile icon={GraduationCap} title="Adaptive Learning" desc="Belief recalibration via real outcomes" tint="text-money">
                  <LearnPanel seed={seed} n={n} />
                </DrawerTile>
                <DrawerTile icon={TrendingUp} title="Cost & Churn Analysis" desc="Net-value sensitivity sweep" tint="text-azure">
                  <ChurnPanel seed={seed} n={n} />
                </DrawerTile>
                <DrawerTile icon={ShieldCheck} title="Verification & Guarantees" desc="SHA-256 byte-identical proofs" tint="text-money">
                  <VerifyPanel seed={seed} n={n} />
                </DrawerTile>
              </div>
            </div>
          </TabsContent>

          {/* DEDICATED LIVE SANDBOX TAB */}
          <TabsContent value="live" className="mt-0 focus-visible:outline-none">
            <div className="max-w-2xl mx-auto">
              <RazorpayPanel heroMode />
            </div>
          </TabsContent>

          {/* DEDICATED DATA INGESTION & PIPELINE TAB */}
          <TabsContent value="pipeline" className="mt-0 space-y-5 focus-visible:outline-none">
            <PipelinePanel seed={seed} n={n} />
          </TabsContent>

          {/* RECOVER TAB */}
          <TabsContent value="recover" className="mt-0 space-y-5 focus-visible:outline-none">
            <BatchPanel seed={seed} n={n} runId={runId} />
            <RecoveryFlowPanel seed={seed} n={n} delay={40} />
            <SankeyPanel seed={seed} n={n} runId={runId} delay={80} />
            <ChurnPanel seed={seed} n={n} delay={120} />
          </TabsContent>

          {/* RECONCILE TAB */}
          <TabsContent value="reconcile" className="mt-0 space-y-5 focus-visible:outline-none">
            <ExceptionsPanel seed={seed} n={n} />
            <OutcomeModelPanel delay={40} />
          </TabsContent>

          {/* LEARN TAB */}
          <TabsContent value="learn" className="mt-0 focus-visible:outline-none">
            <LearnPanel seed={seed} n={n} />
          </TabsContent>

          {/* VERIFY TAB */}
          <TabsContent value="verify" className="mt-0 focus-visible:outline-none">
            <VerifyPanel seed={seed} n={n} />
          </TabsContent>

          {/* LEDGER TAB */}
          <TabsContent value="ledger" className="mt-0 focus-visible:outline-none">
            <AuditPanel seed={seed} n={n} />
          </TabsContent>
        </Tabs>

        {/* Clean Enterprise Footer */}
        <footer className="mt-12 border-t border-line/80 pt-6 pb-4 text-center text-xs text-faint">
          <p className="font-semibold text-navy">
            Tijori · Closed-Loop Autonomous Revenue Recovery for Razorpay
          </p>
          <p className="mt-1 text-[11px] text-faint">
            Standard library scoring engine with live rzp_test_ API payment integration
          </p>
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
        <button className="group flex w-full items-start gap-3 rounded-2xl border border-line bg-white/90 p-4 text-left shadow-sm transition-all hover:border-azure/30 hover:shadow-md hover:bg-raised/80">
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tint}`} strokeWidth={2} />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-navy">{title}</span>
            <span className="mt-0.5 block text-xs leading-snug text-faint">{desc}</span>
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto border-line bg-canvas p-5 sm:max-w-xl">
        {children}
      </SheetContent>
    </Sheet>
  );
}
