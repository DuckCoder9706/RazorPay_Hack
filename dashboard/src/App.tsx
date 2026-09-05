import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
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
import { motion, AnimatePresence, useScroll, useSpring } from "motion/react";
import { useApi } from "./lib";
import { IntroSplash } from "./components/IntroSplash";
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
  ReconBenchmarkPanel,
} from "./panels";

const N_OPTIONS = [100, 200, 500, 1000, 2000];

const GLOSSARY = [
  { term: "Recovery Policy (R)", def: "Autonomous actuator: maps payment decline codes to calibrated retry timing to maximize net recovered volume." },
  { term: "Reconciliation Sensor (W)", def: "Three-way matching engine: audits gateway records, merchant orders, and bank statements to isolate fee variance and missing credits." },
  { term: "Adaptive Calibration (F1)", def: "Closed-loop feedback: updates transition probabilities from realized settlement outcomes without human intervention." },
  { term: "Recovery Efficiency (F2)", def: "Ratio of captured revenue relative to theoretical maximum recoverable volume." },
  { term: "Net Value Recovery (F3)", def: "Optimization objective balancing gross recovered funds against retry overhead and customer churn risk." },
  { term: "Oracle Upper Bound", def: "Theoretical maximum recoverable volume under complete network observability." },
  { term: "Standard Baseline", def: "Razorpay standard fixed retry schedule (T+1 / T+2 / T+3) without decline classification." },
  { term: "Audit Determinism", def: "Guarantee that identical input seeds yield byte-identical ledger states and verifiable SHA-256 digests." },
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
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerActor, setLedgerActor] = useState<"all" | "R" | "W" | "sim">("all");
  const [entered, setEntered] = useState(false);
  const health = useApi<HealthResponse>("/health", []);

  const { scrollYProgress, scrollY } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 350, damping: 32, restDelta: 0.001 });
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    return scrollY.on("change", (latest) => {
      setIsScrolled(latest > 12);
    });
  }, [scrollY]);

  const handleNavigateToLedger = (query: string, actor: "all" | "R" | "W" | "sim" = "all") => {
    setLedgerSearch(query);
    setLedgerActor(actor);
    setTab("ledger");
  };

  useEffect(() => {
    const p = new URLSearchParams();
    p.set("seed", String(seed));
    p.set("n", String(n));
    p.set("tab", tab);
    window.history.replaceState(null, "", `?${p.toString()}`);
  }, [seed, n, tab]);

  const applyTyped = () => {
    const s = parseInt(draftSeed, 10);
    if (!Number.isNaN(s)) setSeed(s);
    setRunId((r) => r + 1);
  };

  const run = () => {
    const s = Math.floor(Math.random() * 1_000_000);
    setSeed(s);
    setDraftSeed(String(s));
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
      {!entered && <IntroSplash onEnter={() => setEntered(true)} />}

      <motion.div
        className="fixed top-0 left-0 right-0 z-50 h-[2.5px] origin-left bg-gradient-to-r from-azure via-emerald-500 to-azure pointer-events-none"
        style={{ scaleX }}
      />

      <header
        className={`sticky top-0 z-30 transition-all duration-250 ${
          isScrolled
            ? "border-b border-line/90 bg-white/90 shadow-sm backdrop-blur-xl py-2"
            : "border-b border-line/75 bg-white/95 backdrop-blur-md py-2.5"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-3 shrink-0">
            <motion.span
              whileHover={{ rotate: 10, scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className="grid h-9 w-9 place-items-center rounded-xl bg-azure text-white font-mono text-base font-bold shadow-xs cursor-pointer select-none"
            >
              ₹
            </motion.span>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold tracking-tight text-navy">
                Tijori
              </h1>
              <span className="hidden md:inline text-xs font-medium text-slate-400">
                |
              </span>
              <span className="hidden md:inline text-xs font-medium text-slate-500">
                Autonomous Revenue Recovery
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-line bg-slate-50/90 px-2.5 py-0.5 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  health.data ? "bg-money animate-pulse-subtle shadow-[0_0_8px] shadow-money/60" : "bg-rose"
                }`}
              />
              <span className="font-mono text-[11px] font-medium text-slate-600">
                {health.data ? "Live API" : "Offline"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center rounded-xl border border-line/90 bg-slate-50/90 p-1 shadow-xs">
              <div className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 border border-line/80 shadow-2xs">
                <label htmlFor="seed" className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Seed
                </label>
                <input
                  id="seed"
                  value={draftSeed}
                  onChange={(e) => setDraftSeed(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyTyped()}
                  inputMode="numeric"
                  className="w-10 bg-transparent text-center font-mono text-xs font-bold text-navy outline-none"
                />
              </div>

              <div className="mx-1 h-4 w-px bg-slate-200" />

              <div className="flex items-center gap-0.5">
                <span className="hidden xl:inline px-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Batch
                </span>
                {N_OPTIONS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setN(v)}
                    aria-pressed={n === v}
                    className={`rounded-lg px-2.5 py-1 font-mono text-xs tabular-nums transition-all ${
                      n === v
                        ? "bg-azure font-semibold text-white shadow-xs"
                        : "text-slate-600 hover:text-navy hover:bg-white"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              <div className="mx-1 h-4 w-px bg-slate-200" />

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={run}
                title="Run a fresh batch on a new random seed"
                className="rounded-lg bg-navy hover:bg-navy-light px-3.5 py-1 text-xs font-semibold text-white shadow-xs transition-colors"
              >
                Run
              </motion.button>
            </div>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={copyLink}
              title="Copy shareable link to this exact view"
              className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white text-slate-500 shadow-xs transition-colors hover:text-navy hover:bg-slate-50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-money" /> : <Link2 className="h-3.5 w-3.5" />}
            </motion.button>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  title="Architecture Glossary"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white text-slate-500 shadow-xs transition-colors hover:text-navy hover:bg-slate-50"
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
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="mb-6 w-full">
            <TabsList className="relative flex h-auto w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-line/80 bg-white/95 p-1.5 shadow-sm backdrop-blur-md">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = tab === t.v;
                return (
                  <TabsTrigger
                    key={t.v}
                    value={t.v}
                    className={`relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors z-10 ${
                      isActive
                        ? "text-white"
                        : t.highlight
                        ? "text-azure bg-azure-light/60 hover:bg-azure-light"
                        : "text-slate-600 hover:text-navy hover:bg-slate-50"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="activeTabPill"
                        className="absolute inset-0 rounded-xl bg-azure shadow-md -z-10"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      />
                    )}
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{t.label}</span>
                    {t.highlight && (
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                          isActive ? "bg-white/20 text-white" : "bg-azure text-white"
                        }`}
                      >
                        LIVE
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0 space-y-6 focus-visible:outline-none">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              <div className="grid gap-5 lg:grid-cols-12 items-stretch">
                <div className="lg:col-span-7 flex flex-col">
                  <BatchPanel seed={seed} n={n} runId={runId} />
                </div>
                <div className="lg:col-span-5 flex flex-col">
                  <RazorpayPanel heroMode />
                </div>
              </div>

              <SankeyPanel
                seed={seed}
                n={n}
                runId={runId}
                delay={20}
                onNavigateToLedger={handleNavigateToLedger}
              />

              <PipelineSummaryCard seed={seed} n={n} onNavigate={() => setTab("pipeline")} />

              <div className="grid gap-5 lg:grid-cols-12">
                <div className="lg:col-span-5 flex">
                  <InsightCard seed={seed} n={n} delay={40} />
                </div>
                <motion.div
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.1 }}
                  variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.08 } },
                  }}
                  className="lg:col-span-7 grid gap-3 sm:grid-cols-2"
                >
                  <DrawerTile icon={ScanSearch} title="3-Way Reconciliation" desc="Settlement audit & exception isolation" tint="text-azure">
                    <ExceptionsPanel seed={seed} n={n} />
                  </DrawerTile>
                  <DrawerTile icon={GraduationCap} title="Adaptive Learning" desc="Autonomous belief calibration from settlement telemetry" tint="text-money">
                    <LearnPanel seed={seed} n={n} />
                  </DrawerTile>
                  <DrawerTile icon={TrendingUp} title="Cost & Churn Analysis" desc="Net value optimization across friction tiers" tint="text-azure">
                    <ChurnPanel seed={seed} n={n} />
                  </DrawerTile>
                  <DrawerTile icon={ShieldCheck} title="Verification & Guarantees" desc="SHA-256 byte-identical audit proofs" tint="text-money">
                    <VerifyPanel seed={seed} n={n} />
                  </DrawerTile>
                </motion.div>
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="live" className="mt-0 focus-visible:outline-none">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-2xl mx-auto"
            >
              <RazorpayPanel heroMode />
            </motion.div>
          </TabsContent>

          <TabsContent value="pipeline" className="mt-0 focus-visible:outline-none">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              <PipelinePanel seed={seed} n={n} />
            </motion.div>
          </TabsContent>

          <TabsContent value="recover" className="mt-0 focus-visible:outline-none">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              <BatchPanel seed={seed} n={n} runId={runId} />
              <RecoveryFlowPanel seed={seed} n={n} delay={40} />
              <ChurnPanel seed={seed} n={n} delay={120} />
            </motion.div>
          </TabsContent>

          <TabsContent value="reconcile" className="mt-0 focus-visible:outline-none">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              <ExceptionsPanel seed={seed} n={n} />
              <ReconBenchmarkPanel seed={seed} n={n} delay={40} />
              <OutcomeModelPanel delay={60} />
            </motion.div>
          </TabsContent>

          <TabsContent value="learn" className="mt-0 focus-visible:outline-none">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <LearnPanel seed={seed} n={n} />
            </motion.div>
          </TabsContent>

          <TabsContent value="verify" className="mt-0 focus-visible:outline-none">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <VerifyPanel seed={seed} n={n} />
            </motion.div>
          </TabsContent>

          <TabsContent value="ledger" className="mt-0 focus-visible:outline-none">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <AuditPanel
                seed={seed}
                n={n}
                initialSearch={ledgerSearch}
                initialActor={ledgerActor}
                onClearFilters={() => {
                  setLedgerSearch("");
                  setLedgerActor("all");
                }}
              />
            </motion.div>
          </TabsContent>
        </Tabs>
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
        <motion.button
          variants={{
            hidden: { opacity: 0, y: 14 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
          }}
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.985 }}
          className="group flex w-full items-start justify-between gap-3 rounded-2xl border border-line bg-white/90 p-4 text-left shadow-sm transition-all hover:border-azure/30 hover:shadow-md hover:bg-raised/80"
        >
          <div className="flex items-start gap-3 min-w-0">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tint}`} strokeWidth={2} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-navy">{title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-faint">{desc}</span>
            </span>
          </div>
          <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition-all -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-azure" />
        </motion.button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto border-line bg-canvas p-5 sm:max-w-xl">
        {children}
      </SheetContent>
    </Sheet>
  );
}
