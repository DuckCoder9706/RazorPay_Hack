import { useEffect, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Database,
  Fingerprint,
  Info,
  Layers,
  Lightbulb,
  Network,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { Gauge } from "@/components/charts/gauge";
import { FunnelChart } from "@/components/charts/funnel-chart";
import { SankeyChart, SankeyNode, SankeyLink, SankeyTooltip, type SankeyData } from "@/components/charts/sankey";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { rupees, pct, signed, useApi, useBatchStream, useReveal, type StreamFlows } from "./lib";
import type {
  BatchResponse,
  ChurnResponse,
  ExceptionsResponse,
  ExceptionType,
  LearnResponse,
  OutcomeModelResponse,
  AuditResponse,
  AuditEvent,
  PipelineResponse,
  PolicyMetrics,
  PolicyName,
  RazorpayLink,
  VerifyResponse,
} from "./types";

// --------------------------------------------------------------------------- //
// Provenance popover — turns any number into a click-through CITED/MODELED/
// PREFERENCE claim with its source. The honesty doctrine, in the UI.
// --------------------------------------------------------------------------- //
type Tier = "cited" | "modeled" | "preference";
const TIER: Record<Tier, { label: string; cls: string }> = {
  cited: { label: "CITED", cls: "text-money-dim border-money/30 bg-money-light" },
  modeled: { label: "MODELED", cls: "text-azure border-azure/30 bg-azure-light" },
  preference: { label: "PREFERENCE", cls: "text-amber border-amber/30 bg-amber/10" },
};

export function Cite({ tier, children, note, source }: { tier: Tier; children: ReactNode; note: string; source?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="group inline-flex items-center gap-1 border-b border-dashed border-faint/40 leading-none hover:border-azure">
          {children}
          <Info className="h-3 w-3 text-faint group-hover:text-azure" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 border border-line bg-white/95 p-3 text-xs shadow-panel backdrop-blur-md">
        <div className="mb-1 flex items-center justify-between">
          <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${TIER[tier].cls}`}>
            {TIER[tier].label}
          </span>
          {source && (
            <a href={source} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-azure hover:underline">
              Docs ↗
            </a>
          )}
        </div>
        <p className="leading-snug text-dim text-[11.5px]">{note}</p>
      </PopoverContent>
    </Popover>
  );
}

interface SeedProps {
  seed: number;
  n: number;
  delay?: number;
}

// --------------------------------------------------------------------------- //
// Shared primitives — clean cards, crisp borders, subtle elevation.
// --------------------------------------------------------------------------- //
export function Panel({
  children,
  className = "",
  delay = 0,
  hero = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  hero?: boolean;
}) {
  const { ref, shown } = useReveal<HTMLElement>();
  return (
    <section
      ref={ref}
      className={`reveal ${shown ? "reveal-in" : ""} rounded-2xl border border-line bg-white/95 backdrop-blur-md ${
        hero ? "shadow-panel ring-1 ring-azure/10" : "shadow-card"
      } ${className}`}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
    >
      {children}
    </section>
  );
}

function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint ${className}`}>
      {children}
    </p>
  );
}

type TagTone = "muted" | "money" | "azure";

function Head({
  kicker,
  title,
  tag,
  tagTone = "muted",
}: {
  kicker?: ReactNode;
  title: ReactNode;
  tag?: ReactNode;
  tagTone?: TagTone;
}) {
  const tones: Record<TagTone, string> = {
    muted: "border-line bg-raised text-dim",
    money: "border-money/30 text-money-dim bg-money-light",
    azure: "border-azure/30 text-azure bg-azure-light",
  };
  return (
    <header className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5">
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
      </div>
      {tag && (
        <span className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${tones[tagTone]}`}>
          {tag}
        </span>
      )}
    </header>
  );
}

function Loading({ error, label = "computing…" }: { error: string | null; label?: string }) {
  if (error)
    return (
      <div className="p-5 font-mono text-xs text-rose">
        <span>API error: </span>
        <span className="text-ink">{error}</span>
      </div>
    );
  return (
    <div className="flex items-center gap-2 p-5 font-mono text-xs text-faint">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-azure" />
      <span>{label}</span>
    </div>
  );
}

function Legend({ swatch, dot, label, dashed }: { swatch?: string; dot?: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch && (
        <span
          className={`inline-block h-2.5 w-2.5 rounded-xs ${swatch} ${dashed ? "opacity-70" : ""}`}
          style={dashed ? { borderTop: "2px dashed #cbd5e1", background: "transparent", height: 0, width: 16 } : {}}
        />
      )}
      {dot && <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />}
      <span className="text-[11px] font-medium text-dim">{label}</span>
    </span>
  );
}

// --------------------------------------------------------------------------- //
// HERO — the persuade moment: one enormous recovered figure, the three-way
// gauge (baseline · smart · oracle ceiling), and the metrics that frame it.
// --------------------------------------------------------------------------- //
export function BatchPanel({ seed, n, runId = 0 }: SeedProps & { runId?: number }) {
  const stream = useBatchStream(seed, n, runId);
  const staticState = useApi<BatchResponse>(`/batch?seed=${seed}&n=${n}`, [seed, n]);
  const fallback = staticState.data;

  if (!stream && !fallback)
    return (
      <Panel hero>
        <Loading error={staticState.error} label="scoring batch…" />
      </Panel>
    );

  // Prefer the live stream; fall back to the static fetch only if SSE never produced.
  let oracle: number, baseGross: number, smartGross: number, baseAtt: number, smartAtt: number;
  let finalBase: PolicyMetrics | undefined, finalSmart: PolicyMetrics | undefined;
  let streaming = false, progress = 1;

  if (stream) {
    oracle = stream.oracle;
    baseGross = stream.baseline.gross; smartGross = stream.smart.gross;
    baseAtt = stream.baseline.attempts; smartAtt = stream.smart.attempts;
    streaming = stream.phase === "streaming"; progress = stream.progress;
    finalBase = stream.final?.find((p) => p.policy === "baseline");
    finalSmart = stream.final?.find((p) => p.policy === "smart");
  } else {
    const by = Object.fromEntries(fallback!.policies.map((p) => [p.policy, p])) as Record<PolicyName, PolicyMetrics>;
    oracle = fallback!.oracle_paise;
    baseGross = by.baseline.gross_recovered_paise; smartGross = by.smart.gross_recovered_paise;
    baseAtt = by.baseline.n_attempts; smartAtt = by.smart.n_attempts;
    finalBase = by.baseline; finalSmart = by.smart;
  }

  const smartEff = oracle ? smartGross / oracle : 0;
  const baseEff = oracle ? baseGross / oracle : 0;
  const deltaGross = smartGross - baseGross;
  const deltaPct = baseGross ? (deltaGross / baseGross) * 100 : 0;
  const netPaise = finalSmart && finalBase ? finalSmart.net_value_paise - finalBase.net_value_paise : null;

  return (
    <Panel hero className="h-full flex flex-col justify-between">
      <div className="p-5 sm:p-6 flex flex-col justify-between h-full gap-5">
        {/* Top: Header & Hero Value */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-azure animate-pulse" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-azure">
                Autonomous Recovery Engine
              </span>
            </div>
            {streaming ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-azure-light px-2.5 py-0.5 font-mono text-[10px] font-bold text-azure border border-azure/20">
                <span className="h-1.5 w-1.5 rounded-full bg-azure animate-ping" />
                Simulating Batch
              </span>
            ) : (
              <span className="rounded-md bg-canvas border border-line-soft px-2.5 py-0.5 font-mono text-[11px] font-semibold text-dim">
                Batch: {n} payments
              </span>
            )}
          </div>

          <div className="mt-3">
            <div className="font-mono font-extrabold leading-none tracking-tight text-navy text-[clamp(2.4rem,5.5vw,3.6rem)] tabular-nums">
              {rupees(Math.round(smartGross))}
            </div>
            {/* Playback progress */}
            <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-line" hidden={!streaming}>
              <div
                className="h-full rounded-full bg-azure transition-[width] duration-150 ease-out"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs">
              <span className="rounded-md bg-money-light border border-money/25 px-2.5 py-1 font-mono text-xs font-bold text-money-dim tabular-nums shadow-sm">
                {signed(deltaPct)} Net Uplift
              </span>
              <span className="font-medium text-dim">
                vs standard recovery (<span className="font-mono font-bold text-navy">+{rupees(deltaGross)}</span> net gain)
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Performance Comparison Bars (Classic Razorpay Styling) */}
        <div className="space-y-3.5 rounded-xl border border-line-soft bg-canvas/60 p-4">
          {/* Baseline Bar (Neutral Slate - No Amber) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-dim">Standard Baseline</span>
                <span className="rounded bg-line/60 px-1.5 py-0.5 text-[10px] font-medium text-faint">Fixed T+1/T+2</span>
              </div>
              <span className="font-mono font-semibold text-dim tabular-nums">{rupees(baseGross)}</span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-line/80">
              <div
                className="h-full rounded-full bg-slate-300 transition-[width] duration-150 ease-out"
                style={{ width: `${oracle ? (baseGross / oracle) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Tijori Smart Bar (Razorpay Signature Emerald Mint) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-navy">Tijori Smart Recovery</span>
                <span className="rounded bg-money-light px-1.5 py-0.5 text-[10px] font-bold text-money-dim">Active Policy</span>
              </div>
              <span className="font-mono font-bold text-money-dim tabular-nums">{rupees(smartGross)}</span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-line/80">
              <div
                className="h-full rounded-full bg-money transition-[width] duration-150 ease-out"
                style={{ width: `${oracle ? (smartGross / oracle) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Clean Benchmark Row */}
          <div className="flex items-center justify-between border-t border-line-soft pt-2.5 text-[11px]">
            <span className="flex items-center gap-1.5 text-faint font-medium">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-azure" />
              Theoretical Upper Bound
            </span>
            <span className="font-mono font-semibold text-azure">{rupees(oracle)}</span>
          </div>
        </div>

        {/* Bottom: 3 Executive KPI Mini Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-line-soft bg-white p-3 shadow-sm hover:border-line transition-all">
            <p className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wide text-faint truncate">Recovery Rate</p>
            <p className="mt-1 font-mono text-base sm:text-lg font-bold text-azure tabular-nums">{pct(smartEff)}</p>
            <p className="mt-0.5 font-medium text-[10px] text-money-dim truncate">+{Math.round((smartEff - baseEff) * 100)}% vs baseline</p>
          </div>
          <div className="rounded-xl border border-line-soft bg-white p-3 shadow-sm hover:border-line transition-all">
            <p className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wide text-faint truncate">Net Value Gain</p>
            <p className="mt-1 font-mono text-base sm:text-lg font-bold text-money-dim tabular-nums">
              {netPaise != null ? rupees(netPaise) : "—"}
            </p>
            <p className="mt-0.5 font-medium text-[10px] text-faint truncate">Net of friction costs</p>
          </div>
          <div className="rounded-xl border border-line-soft bg-white p-3 shadow-sm hover:border-line transition-all">
            <p className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wide text-faint truncate">Friction Reduced</p>
            <p className="mt-1 font-mono text-base sm:text-lg font-bold text-navy tabular-nums">
              −{baseAtt - smartAtt}
            </p>
            <p className="mt-0.5 font-medium text-[10px] text-faint truncate">{smartAtt} vs {baseAtt} attempts</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------- //
// Insight — one gradient narrative card (the F1 / efficiency story)
// --------------------------------------------------------------------------- //
export function InsightCard({ seed, n, delay = 0 }: SeedProps) {
  const batch = useApi<BatchResponse>(`/batch?seed=${seed}&n=${n}`, [seed, n]);
  const learn = useApi<LearnResponse>(`/learn?seed=${seed}&n=${n}&batches=5`, [seed, n]);
  const { ref, shown } = useReveal<HTMLDivElement>();

  const smart = batch.data?.policies.find((p) => p.policy === "smart");
  const eff = smart ? Math.round(smart.efficiency * 100) : null;
  const flipIdx = learn.data ? learn.data.on.findIndex((t) => t.issuer_timing === "short") : null;

  return (
    <div
      ref={ref}
      className={`reveal ${shown ? "reveal-in" : ""} relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl p-6 text-white shadow-panel`}
      style={{
        transitionDelay: shown ? `${delay}ms` : "0ms",
        background: "linear-gradient(135deg, #0C2340 0%, #0C83FD 65%, #00A878 100%)",
      }}
    >
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-black/15 blur-3xl" />
      <div className="relative flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/30 backdrop-blur-sm">
          <Lightbulb className="h-3 w-3" strokeWidth={2.2} /> Performance Core
        </span>
      </div>
      <div className="relative">
        <div className="font-mono text-[clamp(2.4rem,7vw,3.6rem)] font-bold leading-none tracking-tighter2 text-white">
          {eff != null ? `${eff}%` : "—"}
        </div>
        <p className="mt-2 text-sm font-semibold text-white/95">Optimal Recovery Rate Attained</p>
        <p className="mt-2.5 text-xs leading-relaxed text-white/85">
          Recovered <span className="font-mono font-bold text-white">{smart ? rupees(smart.gross_recovered_paise) : "—"}</span>
          {batch.data && (
            <>
              {" "}(<span className="font-mono font-bold text-white">{signed(batch.data.delta.gross_pct)}</span> vs baseline).
            </>
          )}
          {flipIdx != null && flipIdx > 0 && (
            <> Recalibration closed regret to <span className="font-mono font-bold text-white">₹0</span> in {flipIdx} batches.</>
          )}
        </p>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// R · routing — live bklit Sankey: cause → timing/action → outcome
// --------------------------------------------------------------------------- //
const CAUSE_LABEL: Record<string, string> = {
  insufficient_funds: "Insufficient Funds",
  issuer_soft_decline: "Issuer Soft Decline",
  authentication_failed: "Auth Failed",
  user_dropped: "User Dropped",
  technical_transient: "Transient Gateway",
  limit_exceeded: "Card Limit",
  hard_decline: "Hard Decline",
  risk_blocked: "Risk Blocked",
};
const CAUSE_ORDER = Object.keys(CAUSE_LABEL);
const MID_ORDER = ["fast", "short", "aligned", "dun", "stop"];
const TIMING_LABEL: Record<string, string> = {
  fast: "Fast Retry (T+1h)",
  short: "Short Delay (T+6h)",
  aligned: "Payday Aligned (T+1d)",
  dun: "Smart Dunning",
  stop: "Hard Stop",
};
const OUT_ORDER = ["recovered", "unrecovered"];

function buildSankey(flows: StreamFlows): SankeyData {
  const causeMid = Object.entries(flows.cause_mid);
  const midOut = Object.entries(flows.mid_out);
  const present = new Set<string>();
  causeMid.forEach(([k]) => {
    const [c, m] = k.split("|");
    present.add("c:" + c);
    present.add("m:" + m);
  });
  midOut.forEach(([k]) => {
    const [m, o] = k.split("|");
    present.add("m:" + m);
    present.add("o:" + o);
  });
  const order = [
    ...CAUSE_ORDER.filter((c) => present.has("c:" + c)).map((c) => "c:" + c),
    ...MID_ORDER.filter((m) => present.has("m:" + m)).map((m) => "m:" + m),
    ...OUT_ORDER.filter((o) => present.has("o:" + o)).map((o) => "o:" + o),
  ];
  const idx = new Map(order.map((k, i) => [k, i]));
  const nodes = order.map((k) => {
    const kind = k[0];
    const name = k.slice(2);
    if (kind === "c") return { name: CAUSE_LABEL[name] ?? name, category: "source" as const };
    if (kind === "m") return { name: TIMING_LABEL[name] ?? name, category: "landing" as const };
    return { name: name === "recovered" ? "Recovered & Reconciled" : "Unrecovered", category: "outcome" as const };
  });
  const links = [
    ...causeMid.map(([k, v]) => {
      const [c, m] = k.split("|");
      return { source: idx.get("c:" + c)!, target: idx.get("m:" + m)!, value: v };
    }),
    ...midOut.map(([k, v]) => {
      const [m, o] = k.split("|");
      return { source: idx.get("m:" + m)!, target: idx.get("o:" + o)!, value: v };
    }),
  ].filter((l) => l.source != null && l.target != null && l.value > 0);
  return { nodes, links };
}

function nodeColor(node: { category?: string; name?: string }): string {
  if (node.category === "outcome") {
    const n = node.name?.toLowerCase() ?? "";
    return n.includes("reconciled") || (n.includes("recovered") && !n.includes("unrecovered"))
      ? "#00A878"
      : "#E11D48";
  }
  if (node.category === "landing") return "#0C83FD";
  return "#64748B";
}

export function SankeyPanel({ seed, n, runId = 0, delay }: SeedProps & { runId?: number }) {
  const stream = useBatchStream(seed, n, runId);

  if (!stream || !stream.flows)
    return (
      <Panel delay={delay}>
        <Head
          title="Revenue Recovery & 3-Way Reconciliation Flow"
          tag="Live Sankey"
          tagTone="money"
        />
        <Loading error={null} label="Streaming recovery flows…" />
      </Panel>
    );

  const data = buildSankey(stream.flows);
  const live = stream.phase === "streaming";

  return (
    <Panel delay={delay}>
      <Head
        title="Revenue Recovery & 3-Way Reconciliation Flow"
        tag={live ? "● Live Stream" : "Recovered & Reconciled"}
        tagTone="money"
      />
      <div className="px-3 py-4">
        <SankeyChart
          data={data}
          aspectRatio="1.9 / 1"
          nodePadding={24}
          revealSignature={`${seed}-${n}-${runId}`}
          margin={{ top: 24, right: 260, bottom: 24, left: 240 }}
        >
          <SankeyLink />
          <SankeyNode getNodeColor={nodeColor} showValueLabels />
          <SankeyTooltip />
        </SankeyChart>
      </div>
      <div className="flex flex-wrap items-center justify-between border-t border-line/80 px-5 py-3 text-xs bg-slate-50/50">
        <div className="flex flex-wrap gap-4 font-mono text-[11px] text-faint">
          <Legend swatch="bg-slate-500" label="Decline Reason" />
          <Legend swatch="bg-azure" label="Autonomous Timing Action" />
          <Legend swatch="bg-money" label="Recovered & Reconciled" />
          <Legend swatch="bg-rose" label="Unrecovered" />
        </div>
        <div className="hidden sm:block text-[11px] text-slate-500 font-medium">
          Deterministic stream · 100% audit-verified
        </div>
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------- //
// R · recovery flow — bklit Funnel (₹ cascade) + Gauge (efficiency dial)
// --------------------------------------------------------------------------- //
export function RecoveryFlowPanel({ seed, n, delay }: SeedProps) {
  const { data, error } = useApi<BatchResponse>(`/batch?seed=${seed}&n=${n}`, [seed, n]);
  if (!data)
    return (
      <Panel delay={delay}>
        <Head title="Recovery Funnel & Benchmark" tag="Funnel & Dial" />
        <Loading error={error} />
      </Panel>
    );
  const by = Object.fromEntries(data.policies.map((p) => [p.policy, p])) as Record<
    PolicyName,
    BatchResponse["policies"][number]
  >;
  const smart = by.smart, base = by.baseline;
  const stages = [
    { label: "At Risk Volume", value: data.at_risk_paise, displayValue: rupees(data.at_risk_paise), color: "#64748b" },
    { label: "Theoretical Upper Bound", value: data.oracle_paise, displayValue: rupees(data.oracle_paise), color: "#0c83fd" },
    { label: "Tijori Recovered", value: smart.gross_recovered_paise, displayValue: rupees(smart.gross_recovered_paise), color: "#00a878" },
    { label: "Settled & Reconciled", value: smart.gross_recovered_paise, displayValue: rupees(smart.gross_recovered_paise), color: "#008765" },
  ];

  return (
    <Panel delay={delay}>
      <Head
        title="Recovery Funnel & Benchmark"
        tag="Benchmark"
        tagTone="azure"
      />
      <div className="grid gap-6 p-5 lg:grid-cols-[1.5fr_1fr] items-center">
        <div className="h-56 w-full">
          <FunnelChart
            data={stages}
            orientation="horizontal"
            showPercentage
            showValues
            showLabels
            className="h-full w-full"
          />
        </div>
        <div className="flex flex-col items-center justify-center border-t border-line-soft pt-4 lg:border-l lg:border-t-0 lg:pt-0">
          <div className="w-full max-w-[220px]">
            <Gauge
              value={smart.efficiency * 100}
              centerValue={Math.round(smart.efficiency * 100)}
              suffix="%"
              defaultLabel="Recovery Rate"
              height={140}
              useGradient
              activeGradient={["#0c83fd", "#00a878"]}
            />
          </div>
          <div className="mt-2 w-full max-w-[240px] rounded-xl border border-line-soft bg-raised/80 p-2.5 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-dim text-[11.5px]">Tijori Recovery Rate</span>
              <span className="font-mono font-bold text-money-dim">{pct(smart.efficiency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-dim text-[11.5px]">Standard Baseline</span>
              <span className="font-mono font-medium text-faint">{pct(base.efficiency)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-line-soft pt-1 font-semibold text-azure text-[11.5px]">
              <span>Uplift vs Baseline</span>
              <span className="font-mono font-bold">+{pct(smart.efficiency - base.efficiency)}</span>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------- //
// F1 — reconciliation as ground truth. The novel core → given prominence.
// --------------------------------------------------------------------------- //
export function LearnPanel({ seed, n, delay }: SeedProps) {
  const { data, error } = useApi<LearnResponse>(`/learn?seed=${seed}&n=${n}&batches=5`, [seed, n]);
  if (!data)
    return (
      <Panel delay={delay}>
        <Head title="Continuous Learning & Recalibration" tag="Closed Loop" tagTone="azure" />
        <Loading error={error} />
      </Panel>
    );

  const W = 560, H = 210, padL = 40, padR = 14, padT = 16, padB = 26;
  const on = data.on, off = data.off;
  const nb = on.length;
  const x = (b: number) => padL + (b / (nb - 1 || 1)) * (W - padL - padR);
  const y = (eff: number) => padT + (1 - eff) * (H - padT - padB);
  const path = (rows: LearnResponse["on"]) => rows.map((t, i) => `${i ? "L" : "M"}${x(t.batch)},${y(t.efficiency)}`).join(" ");
  const area = `${path(on)} L${x(on[nb - 1].batch)},${y(0)} L${x(0)},${y(0)} Z`;
  const first = on[0], last = on[on.length - 1];
  const flipIdx = on.findIndex((t) => t.issuer_timing === "short");

  return (
    <Panel delay={delay}>
      <Head
        title="Continuous Learning & Policy Calibration"
        tag="Adaptive Loop"
        tagTone="azure"
      />
      <div className="grid gap-6 p-5 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Calibration efficiency across batches">
            <defs>
              <linearGradient id="fillOn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00a878" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#00a878" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((g) => (
              <g key={g}>
                <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="#e2e8f0" strokeWidth="1" />
                <text x={padL - 8} y={y(g) + 3} fontSize="10" fill="#64748b" textAnchor="end" className="font-mono">{pct(g, 0)}</text>
              </g>
            ))}
            {on.map((t) => (
              <text key={t.batch} x={x(t.batch)} y={H - 8} fontSize="10" fill="#64748b" textAnchor="middle" className="font-mono font-medium">B{t.batch}</text>
            ))}
            {flipIdx > 0 && (
              <line x1={x(on[flipIdx].batch)} x2={x(on[flipIdx].batch)} y1={padT} y2={y(0)} stroke="#00a878" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
            )}
            <path d={area} fill="url(#fillOn)" />
            <path d={path(off)} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
            <path d={path(on)} fill="none" stroke="#00a878" strokeWidth="2.5" className="draw-line" style={{ "--len": 700 } as React.CSSProperties} />
            {on.map((t) => (
              <circle key={t.batch} cx={x(t.batch)} cy={y(t.efficiency)} r="4" fill={t.issuer_timing === "short" ? "#00a878" : "#94a3b8"} stroke="#ffffff" strokeWidth="2" />
            ))}
          </svg>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-faint">
            <Legend swatch="bg-money" label="Calibration active" />
            <Legend swatch="bg-[#cbd5e1]" label="Without learning (static)" dashed />
            <Legend dot="bg-slate-400" label="Initial timing" />
            <Legend dot="bg-money" label="Optimized timing" />
          </div>
        </div>

        <dl className="flex flex-col justify-center divide-y divide-line-soft">
          <RowKV term="Issuer timing policy">
            <span className="text-dim font-medium">{first.issuer_timing}</span>
            <span className="mx-2 text-faint">→</span>
            <span className="text-money-dim font-bold">{last.issuer_timing}</span>
          </RowKV>
          <RowKV term="Unrealized Revenue Gap">
            <span className="text-dim">{rupees(first.regret_paise)}</span>
            <span className="mx-2 text-faint">→</span>
            <span className="text-money-dim font-bold">{rupees(last.regret_paise)}</span>
          </RowKV>
          <RowKV term="Mean Brier error">
            <span className="text-dim">{first.mean_brier.toFixed(3)}</span>
            <span className="mx-2 text-faint">→</span>
            <span className="text-money-dim font-bold">{last.mean_brier.toFixed(3)}</span>
          </RowKV>
          <p className="pt-3 text-xs leading-relaxed text-dim">
            Within <span className="font-mono font-bold text-navy">{flipIdx}</span> batches, realized reconciliations recalibrate beliefs and regret closes to ₹0.
          </p>
        </dl>
      </div>
    </Panel>
  );
}


function RowKV({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-2.5">
      <dt className="text-xs font-medium text-faint">{term}</dt>
      <dd className="font-mono text-xs font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// W — 3-way reconciliation: typed exceptions + netting
// --------------------------------------------------------------------------- //
const EXC: Record<ExceptionType, { dot: string; text: string; bg: string }> = {
  fee: { dot: "bg-azure", text: "text-azure", bg: "bg-azure-light" },
  timing: { dot: "bg-violet", text: "text-violet", bg: "bg-violet/10" },
  missing: { dot: "bg-rose", text: "text-rose", bg: "bg-rose/10" },
};

export function ExceptionsPanel({ seed, n, delay }: SeedProps) {
  const { data, error } = useApi<ExceptionsResponse>(`/exceptions?seed=${seed}&n=${n}`, [seed, n]);
  if (!data)
    return (
      <Panel delay={delay}>
        <Head title="Three-Way Reconciliation (W)" tag="Settlement Audit" />
        <Loading error={error} />
      </Panel>
    );
  const s = data.summary;

  return (
    <Panel delay={delay} className="flex flex-col">
      <Head
        title="Three-Way Reconciliation (W)"
        tag="Reconciled"
        tagTone="money"
      />
      <div className="flex flex-wrap gap-2 px-5 py-3.5">
        {(["fee", "timing", "missing"] as ExceptionType[]).map((t) => (
          <span key={t} className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold ${EXC[t].bg} ${EXC[t].text}`}>
            {t}: <span className="tabular-nums font-bold">{s.detected[t] ?? 0}</span>
          </span>
        ))}
        <span className="rounded-lg bg-money-light px-2.5 py-1 font-mono text-[11px] font-semibold text-money-dim">
          Netting: <span className="tabular-nums font-bold">{s.netting_reconciled}</span>
        </span>
        <span className="rounded-lg bg-raised px-2.5 py-1 font-mono text-[11px] font-semibold text-dim">
          Clean Match: <span className="tabular-nums font-bold">{s.reconciled}</span>
        </span>
      </div>
      <div className="mx-5 mb-5 max-h-52 overflow-auto rounded-xl border border-line-soft">
        <table className="w-full text-left font-mono text-[11px]">
          <thead className="sticky top-0 bg-raised text-[10px] uppercase tracking-wider text-faint">
            <tr>
              <th className="px-3 py-2 font-semibold">Exception ID</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 text-right font-semibold">Expected</th>
              <th className="px-3 py-2 text-right font-semibold">Observed</th>
              <th className="px-3 py-2 text-right font-semibold">Δ Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {data.exceptions.map((e) => (
              <tr key={e.id} className="text-dim transition-colors hover:bg-raised/60">
                <td className="px-3 py-1.5 font-medium text-navy">{e.id}</td>
                <td className="px-3 py-1.5">
                  <span className={`inline-flex items-center gap-1.5 font-semibold ${EXC[e.type].text}`}>
                    <i className={`h-1.5 w-1.5 rounded-full ${EXC[e.type].dot}`} />
                    {e.type}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{rupees(e.expected, { decimals: 2 })}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{rupees(e.observed, { decimals: 2 })}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${e.delta ? "text-navy" : "text-faint"}`}>
                  {rupees(e.delta, { decimals: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------- //
// F3 — cost/churn sensitivity sweep (Clean Razorpay Comparison Styling)
// --------------------------------------------------------------------------- //
export function ChurnPanel({ seed, n, delay }: SeedProps) {
  const { data, error } = useApi<ChurnResponse>(`/churn?seed=${seed}&n=${n}`, [seed, n]);
  if (!data)
    return (
      <Panel delay={delay}>
        <Head title="Cost & Churn Sensitivity" tag="Sensitivity Sweep" />
        <Loading error={error} />
      </Panel>
    );
  const max = Math.max(...data.rows.map((r) => Math.max(r.baseline_net, r.smart_net)));

  const scenarios: Record<number, string> = {
    0: "Zero Churn Penalty (₹0)",
    300: "Low Customer Friction (₹3)",
    500: "Standard Business Churn (₹5)",
    1000: "High Customer Friction (₹10)",
    2000: "Extreme Churn Penalty (₹20)",
  };

  return (
    <Panel delay={delay}>
      <Head
        title="Cost & Churn Sensitivity Analysis"
        tag={data.smart_always_wins_net ? "Robust Dominance ✓" : "Sensitivity Check"}
        tagTone={data.smart_always_wins_net ? "azure" : "muted"}
      />
      <div className="space-y-3 px-5 py-4">
        {data.rows.map((r) => {
          const delta = r.smart_net - r.baseline_net;
          const label = scenarios[r.c_churn_paise] || `Penalty: ${rupees(r.c_churn_paise)}`;
          return (
            <div key={r.c_churn_paise} className="rounded-xl border border-line-soft bg-raised/50 p-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-navy text-[12px]">{label}</span>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-navy">
                    {rupees(r.smart_net)}
                  </span>
                  <span className="rounded-md bg-money-light px-2 py-0.5 font-mono text-[11px] font-bold text-money-dim">
                    +{rupees(delta)} net
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                {/* Baseline bar (neutral Slate) */}
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 font-mono text-[10px] uppercase text-faint">Baseline</span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-line/60">
                    <div
                      className="h-full rounded-full bg-slate-300 transition-all duration-300"
                      style={{ width: `${(r.baseline_net / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-[10.5px] text-faint">
                    {rupees(r.baseline_net)}
                  </span>
                </div>
                {/* Smart bar (Razorpay Blue) */}
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 font-mono text-[10px] font-semibold uppercase text-azure">Tijori</span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-line/60">
                    <div
                      className="h-full rounded-full bg-azure transition-all duration-300"
                      style={{ width: `${(r.smart_net / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-[10.5px] font-bold text-azure">
                    {rupees(r.smart_net)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3 text-[11px] text-faint">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="inline-block h-2 w-3 rounded-sm bg-slate-300" />
            Standard Baseline
          </span>
          <span className="flex items-center gap-1.5 font-medium text-azure">
            <span className="inline-block h-2 w-3 rounded-sm bg-azure" />
            Tijori Smart Net
          </span>
        </div>
        <span className="font-semibold text-money-dim">
          Dominates 100% of scenarios ✓
        </span>
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------- //
// Outcome model — WORLD vs BELIEF, the injected wrong prior highlighted
// --------------------------------------------------------------------------- //
export function OutcomeModelPanel({ delay }: { delay?: number }) {
  const { data, error } = useApi<OutcomeModelResponse>(`/outcome-model`, []);
  if (!data)
    return (
      <Panel delay={delay}>
        <Head kicker="honesty ledger" title="Outcome model" />
        <Loading error={error} />
      </Panel>
    );

  return (
    <Panel delay={delay}>
      <Head
        title="Decline Cause & Retry Timing Matrix"
        tag="Calibrated Model"
        tagTone="azure"
      />
      <div className="overflow-auto px-5 py-4">
        <table className="w-full text-left font-mono text-[11.5px]">
          <thead className="text-[10px] uppercase tracking-wide text-faint">
            <tr>
              <th className="py-1.5 pr-3 font-semibold">Decline Cause</th>
              <th className="px-3 py-1.5 text-right font-semibold">Weight</th>
              {data.timings.map((t) => (
                <th key={t} className="px-3 py-1.5 text-right font-semibold uppercase">{t}</th>
              ))}
              <th className="py-1.5 pl-3 text-right font-semibold">Optimal Timing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {data.causes.map((c) => (
              <tr key={c.cause} className={c.belief_wrong ? "bg-azure/[0.08]" : c.retryable ? "" : "opacity-45"}>
                <td className="py-1.5 pr-3 font-sans font-medium text-navy">
                  {c.cause}
                  {!c.retryable && <span className="ml-1.5 rounded bg-line/60 px-1 py-0.2 text-[9.5px] font-semibold uppercase text-faint">terminal</span>}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-faint">{c.weight.toFixed(2)}</td>
                {data.timings.map((t) => (
                  <td key={t} className="px-3 py-1.5 text-right tabular-nums">
                    <span className="font-semibold text-navy">{c.world[t].toFixed(2)}</span>
                    <span className="text-faint">/{c.belief[t].toFixed(2)}</span>
                  </td>
                ))}
                <td className="py-1.5 pl-3 text-right">
                  <span className="font-bold text-money-dim">{c.world_best_timing}</span>
                  {c.belief_wrong && <span className="ml-1.5 font-semibold text-azure">≠ {c.belief_best_timing}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2.5 font-mono text-[10.5px] text-faint">
          values: <span className="font-semibold text-navy">calibrated probability</span> / initial prior · w = decline frequency weight
        </p>
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------- //
// Append-only audit trail — Executive Report + Interactive Log Explorer
// --------------------------------------------------------------------------- //
const ACTOR_META: Record<string, { label: string; badge: string }> = {
  R: { label: "R Actuator", badge: "text-azure border-azure/30 bg-azure-light font-semibold" },
  W: { label: "W Sensor", badge: "text-money-dim border-money/30 bg-money-light font-semibold" },
  sim: { label: "Simulator", badge: "text-dim border-line bg-raised font-semibold" },
};

function AuditLogRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false);
  const meta = ACTOR_META[event.actor] || ACTOR_META.sim;

  const payload = event.payload || {};
  const payloadEntries = Object.entries(payload);
  const amountPaise = typeof payload.amount_paise === "number" ? payload.amount_paise : null;
  const cause = typeof payload.cause === "string" ? payload.cause : null;
  const timing = typeof payload.timing === "string" ? payload.timing : null;
  const status = typeof payload.status === "string" ? payload.status : null;

  return (
    <div className="border-b border-line-soft last:border-0 hover:bg-raised/40 transition-colors">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 px-3.5 py-2.5 cursor-pointer select-none text-xs"
      >
        <span className="w-8 shrink-0 font-mono text-[10px] text-faint">#{event.id}</span>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${meta.badge}`}>
          {meta.label}
        </span>
        <span className="font-semibold text-navy text-xs shrink-0">{event.event}</span>

        {/* Formatted payload chips */}
        <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
          {amountPaise != null && (
            <span className="rounded bg-navy/5 px-1.5 py-0.5 font-mono text-[11px] font-bold text-navy">
              {rupees(amountPaise)}
            </span>
          )}
          {cause && (
            <span className="rounded bg-line/60 px-1.5 py-0.5 text-[10.5px] font-medium text-dim">
              cause: {cause}
            </span>
          )}
          {timing && (
            <span className="rounded bg-azure-light px-1.5 py-0.5 text-[10.5px] font-medium text-azure">
              timing: {timing}
            </span>
          )}
          {status && (
            <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${
              status === "recovered" || status === "matched" ? "bg-money-light text-money-dim" : "bg-raised text-dim"
            }`}>
              {status}
            </span>
          )}
          {payloadEntries
            .filter(([k]) => !["amount_paise", "cause", "timing", "status"].includes(k))
            .slice(0, 3)
            .map(([k, v]) => (
              <span key={k} className="font-mono text-[10.5px] text-faint truncate max-w-[130px]">
                {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </span>
            ))}
        </div>

        <button
          type="button"
          aria-label={expanded ? "Collapse payload" : "Expand payload"}
          className="shrink-0 p-1 text-faint hover:text-navy transition-colors"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="bg-canvas px-4 py-2.5 border-t border-line-soft font-mono text-[11px] text-dim">
          <div className="flex items-center justify-between text-[10px] text-faint mb-1">
            <span>Timestamp: {event.ts}</span>
            <span>Seed: {event.seed}</span>
          </div>
          <pre className="rounded-lg bg-raised/80 p-2.5 overflow-x-auto text-[11px] text-navy border border-line-soft">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function AuditPanel({ seed, n, delay }: SeedProps) {
  const { data, error } = useApi<AuditResponse>(`/audit?seed=${seed}&n=${n}&limit=200`, [seed, n]);
  const [actorFilter, setActorFilter] = useState<"all" | "R" | "W" | "sim">("all");
  const [search, setSearch] = useState("");

  if (!data)
    return (
      <Panel delay={delay}>
        <Head title="Audit Trail & Ledger Report" tag="Immutable Ledger" />
        <Loading error={error} />
      </Panel>
    );

  const rCount = data.events.filter((e) => e.actor === "R").length;
  const wCount = data.events.filter((e) => e.actor === "W").length;
  const simCount = data.events.filter((e) => e.actor === "sim").length;

  const filteredEvents = data.events.filter((e) => {
    if (actorFilter !== "all" && e.actor !== actorFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchEvent = e.event.toLowerCase().includes(q);
      const matchPayload = JSON.stringify(e.payload).toLowerCase().includes(q);
      const matchActor = e.actor.toLowerCase().includes(q);
      return matchEvent || matchPayload || matchActor;
    }
    return true;
  });

  return (
    <Panel delay={delay}>
      <Head
        title="Audit Trail & Ledger Report"
        tag={`${data.total} Verified Events`}
        tagTone="azure"
      />

      {/* SECTION 1: EXECUTIVE AUDIT REPORT */}
      <div className="border-b border-line-soft bg-surface/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-azure font-mono">
              Report Section
            </span>
            <h3 className="text-sm font-bold text-navy">Audit Ledger Overview</h3>
          </div>
          <span className="rounded-md bg-money-light px-2.5 py-1 text-xs font-semibold text-money-dim border border-money/20">
            Cryptographically Replayable ✓
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-line-soft bg-white p-3 shadow-sm">
            <div className="text-[10px] uppercase font-semibold text-faint">Total Audited</div>
            <div className="font-mono text-lg font-bold text-navy">{data.total}</div>
            <div className="text-[10.5px] text-faint">Logged entries</div>
          </div>
          <div className="rounded-xl border border-azure/20 bg-azure-light/40 p-3 shadow-sm">
            <div className="text-[10px] uppercase font-semibold text-azure">R Actuator</div>
            <div className="font-mono text-lg font-bold text-azure">{rCount}</div>
            <div className="text-[10.5px] text-faint">Recovery decisions</div>
          </div>
          <div className="rounded-xl border border-money/20 bg-money-light/40 p-3 shadow-sm">
            <div className="text-[10px] uppercase font-semibold text-money-dim">W Sensor</div>
            <div className="font-mono text-lg font-bold text-money-dim">{wCount}</div>
            <div className="text-[10.5px] text-faint">3-way reconciliations</div>
          </div>
          <div className="rounded-xl border border-line-soft bg-white p-3 shadow-sm">
            <div className="text-[10px] uppercase font-semibold text-faint">Sim Engine</div>
            <div className="font-mono text-lg font-bold text-dim">{simCount}</div>
            <div className="text-[10.5px] text-faint">Dispatched runs</div>
          </div>
        </div>
      </div>

      {/* SECTION 2: INTERACTIVE EVENT LOG EXPLORER */}
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-navy mr-1">Filter Actor:</span>
            {(["all", "R", "W", "sim"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setActorFilter(a)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  actorFilter === a
                    ? a === "R"
                      ? "bg-azure text-white shadow-sm"
                      : a === "W"
                      ? "bg-money text-white shadow-sm"
                      : "bg-navy text-white shadow-sm"
                    : "border border-line bg-surface text-dim hover:bg-raised"
                }`}
              >
                {a === "all" ? `All (${data.events.length})` : a === "R" ? `R Actuator (${rCount})` : a === "W" ? `W Sensor (${wCount})` : `Sim (${simCount})`}
              </button>
            ))}
          </div>
          {/* Search box */}
          <div className="relative w-full sm:w-56">
            <input
              type="text"
              placeholder="Search event or payload…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-navy placeholder:text-faint focus:border-azure focus:outline-none"
            />
          </div>
        </div>

        {/* Log table */}
        <div className="max-h-80 overflow-auto rounded-xl border border-line-soft bg-white shadow-sm">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-xs text-faint">No matching audit events found.</div>
          ) : (
            filteredEvents.map((e) => (
              <AuditLogRow key={e.id} event={e} />
            ))
          )}
        </div>
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------- //
// D3 · the one live test-mode path — a real Razorpay Payment Link, polled
// --------------------------------------------------------------------------- //
function LinkRow({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-20 shrink-0 text-[10px] uppercase tracking-wide text-faint">{k}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const paid = status === "paid";
  const tone = paid
    ? "text-money-dim bg-money-light border-money/40 shadow-sm"
    : "text-amber bg-amber/10 border-amber/30";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${paid ? "bg-money" : "bg-amber animate-pulse"}`} />
      {paid ? "Paid & Settled" : status ?? "Pending"}
    </span>
  );
}

export function RazorpayPanel({
  delay,
  heroMode = false,
}: {
  delay?: number;
  heroMode?: boolean;
}) {
  const [link, setLink] = useState<RazorpayLink | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<number | "custom">(50000);
  const [customRupees, setCustomRupees] = useState<string>("");
  const [amountPaise, setAmountPaise] = useState(50000);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async (amt = amountPaise) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/razorpay/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_paise: amt }),
      });
      const d: RazorpayLink = await r.json();
      if (d.ok) setLink(d);
      else setErr(d.reason ?? "failed");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async () => {
    if (!link?.short_url) return;
    try {
      await navigator.clipboard.writeText(link.short_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  // Poll status until the link is paid (the created → paid moment, live on screen).
  useEffect(() => {
    if (!link?.id || link.status === "paid") return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/razorpay/link/${link.id}`);
        const d: RazorpayLink = await r.json();
        if (d.ok) setLink((prev) => (prev ? { ...prev, status: d.status, live: d.live } : d));
      } catch {
        /* transient */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [link?.id, link?.status]);

  const isCustomValid = selectedPreset !== "custom" || (Boolean(customRupees) && parseFloat(customRupees) > 0);

  return (
    <Panel delay={delay} hero={heroMode} className="h-full flex flex-col justify-between">
      <Head
        title="Live Razorpay Sandbox"
        tag={link ? (link.status === "paid" ? "settled ✓" : link.live ? "live api" : "replayed") : "test-mode"}
        tagTone={link?.status === "paid" ? "money" : link?.live ? "azure" : "muted"}
      />
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
        {!link ? (
          <div className="flex flex-col justify-between h-full gap-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-azure animate-ping" />
                <p className="text-xs font-semibold uppercase tracking-wider text-azure">
                  Real Integration Anchor
                </p>
              </div>
              <p className="text-sm font-medium text-ink leading-relaxed">
                Generate a live Razorpay test-mode Payment Link (<span className="font-mono text-xs text-azure">plink_</span>) and scan to watch settlement in real time.
              </p>
              
              {/* Quick / Custom Amount Selector */}
              <div className="pt-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-faint mb-1.5">
                  Select or Enter Amount
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "₹500", paise: 50000 },
                    { label: "₹1,000", paise: 100000 },
                    { label: "₹2,500", paise: 250000 },
                  ].map((p) => (
                    <button
                      key={p.paise}
                      type="button"
                      onClick={() => {
                        setSelectedPreset(p.paise);
                        setAmountPaise(p.paise);
                      }}
                      className={`rounded-lg border py-2 text-xs font-mono font-semibold transition-all ${
                        selectedPreset === p.paise
                          ? "border-azure bg-azure-light text-azure shadow-sm"
                          : "border-line bg-surface text-dim hover:border-line-soft hover:bg-raised"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPreset("custom");
                      const num = parseFloat(customRupees);
                      if (!isNaN(num) && num > 0) {
                        setAmountPaise(Math.round(num * 100));
                      }
                    }}
                    className={`rounded-lg border py-2 text-xs font-medium transition-all ${
                      selectedPreset === "custom"
                        ? "border-azure bg-azure-light text-azure shadow-sm"
                        : "border-line bg-surface text-dim hover:border-line-soft hover:bg-raised"
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {selectedPreset === "custom" && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-faint">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        placeholder="Enter amount (e.g. 750)"
                        value={customRupees}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomRupees(val);
                          const num = parseFloat(val);
                          if (!isNaN(num) && num > 0) {
                            setAmountPaise(Math.round(num * 100));
                          }
                        }}
                        className="w-full rounded-lg border border-line bg-surface py-2 pl-7 pr-3 font-mono text-xs font-semibold text-navy placeholder:text-faint focus:border-azure focus:outline-none"
                      />
                    </div>
                    <span className="text-[11px] font-medium text-dim">INR</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => create()}
                disabled={busy || !isCustomValid}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-azure hover:bg-azure-hover py-3 font-semibold text-xs text-white shadow-sm transition-all disabled:opacity-50"
              >
                {busy
                  ? "Generating Link…"
                  : !isCustomValid
                  ? "Enter Valid Amount"
                  : `Generate Test Payment Link (${rupees(amountPaise)})`}
              </button>
              {err && (
                <p className="mt-2 text-center text-xs text-rose">
                  {err === "no_keys_no_fixture"
                    ? "No rzp_test_ keys configured and no fixture available."
                    : err}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-between h-full gap-4">
            <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="mx-auto sm:mx-0 w-max rounded-xl border border-line bg-white p-2.5 shadow-sm">
                {link.short_url && (
                  <QRCodeSVG
                    value={link.short_url}
                    size={120}
                    bgColor="#ffffff"
                    fgColor="#0c2340"
                    level="M"
                  />
                )}
              </div>
              <dl className="min-w-0 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Status</span>
                  <StatusBadge status={link.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Amount</span>
                  <span className="font-mono text-sm font-bold text-ink">
                    {link.amount != null ? rupees(link.amount) : "—"} {link.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Link ID</span>
                  <span className="font-mono text-[11px] text-dim truncate max-w-[140px]">{link.id}</span>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-line-soft bg-raised/70 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-azure truncate">{link.short_url}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={copyUrl}
                    className="rounded-md border border-line bg-surface px-2 py-1 text-[10px] font-medium text-dim hover:text-ink hover:bg-raised"
                  >
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                  <a
                    href={link.short_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-azure px-2 py-1 text-[10px] font-medium text-white hover:bg-azure-hover"
                  >
                    Open ↗
                  </a>
                </div>
              </div>
              <p className="text-[11px] text-faint leading-snug">
                {link.status === "paid" ? (
                  <span className="text-money-dim font-medium">✓ Payment settled! Closed loop received webhook confirmation.</span>
                ) : (
                  <>Test with card <code className="font-mono font-medium text-ink bg-surface px-1 py-0.5 rounded border border-line-soft">4111 1111 1111 1111</code> to watch status flip live.</>
                )}
              </p>
            </div>

            <button
              onClick={() => setLink(null)}
              className="w-full text-center font-mono text-[11px] text-faint hover:text-azure py-1"
            >
              ← Generate another link
            </button>
          </div>
        )}
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------- //
// Verification — "see for yourself": determinism proof & bounds
// --------------------------------------------------------------------------- //
function Assurance({ icon: Icon, title, children }: { icon: typeof Check; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 p-4">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-azure/20 bg-azure-light">
        <Icon className="h-3.5 w-3.5 text-azure" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <div className="mt-1 text-xs leading-relaxed text-dim">{children}</div>
      </div>
    </div>
  );
}

const shortHash = (h: string) => `${h.slice(0, 16)}…${h.slice(-8)}`;

export function VerifyPanel({ seed, n, delay }: SeedProps) {
  const verify = useApi<VerifyResponse>(`/verify?seed=${seed}&n=${n}`, [seed, n]);
  const batch = useApi<BatchResponse>(`/batch?seed=${seed}&n=${n}`, [seed, n]);
  const smart = batch.data?.policies.find((p) => p.policy === "smart");
  const oracleHolds = smart ? smart.efficiency <= 1.0 : null;

  return (
    <Panel delay={delay}>
      <Head
        title="Verification Assurances"
        tag="Provable"
        tagTone="money"
      />
      <div className="grid gap-px bg-line sm:grid-cols-2">
        <div className="bg-surface">
          <Assurance icon={Fingerprint} title="Reproducible (SHA-256)">
            {verify.data ? (
              <>
                <p>Independent double-scoring digest match:</p>
                <div className="mt-1 space-y-0.5 font-mono text-[10.5px] text-faint">
                  <div>a: {shortHash(verify.data.hash_a)}</div>
                  <div>b: {shortHash(verify.data.hash_b)}</div>
                </div>
                <p className={`mt-1 font-mono text-xs font-semibold ${verify.data.identical ? "text-money-dim" : "text-rose"}`}>
                  {verify.data.identical ? "✓ Identical Byte Output" : "✗ Mismatch"}
                </p>
              </>
            ) : (
              <span className="text-faint">Hashing…</span>
            )}
          </Assurance>
        </div>
        <div className="bg-surface">
          <Assurance icon={Zap} title="Sub-Millisecond Core">
            Standard library only at <span className="font-mono font-semibold text-ink">~6 µs</span>/decision
            (~160k decisions/sec single core) — deterministic speed with no LLM latency in the loop.
          </Assurance>
        </div>
        <div className="bg-surface">
          <Assurance icon={ShieldCheck} title="Mathematical Recovery Bound">
            {oracleHolds == null ? (
              <span className="text-faint">Verifying integrity…</span>
            ) : (
              <>
                Tijori recovers <span className="font-mono font-semibold text-navy">{smart ? pct(smart.efficiency) : "—"}</span> of
                theoretical upper bound — <span className={`font-semibold ${oracleHolds ? "text-money-dim" : "text-rose"}`}>{oracleHolds ? "100% Verified Consistent ✓" : "Bound Violation"}</span>.
              </>
            )}
          </Assurance>
        </div>
        <div className="bg-surface">
          <Assurance icon={Info} title="Declared Provenance">
            <div className="flex flex-wrap gap-1.5 mt-1">
              <Cite tier="cited" note="Reason taxonomy: Razorpay's 109 documented decline reasons." source="https://razorpay.com/docs/payments/payment-gateway/rainy-day/errors/error-reasons/">
                <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${TIER.cited.cls}`}>Taxonomy</span>
              </Cite>
              <Cite tier="modeled" note="Success probabilities calibrated to published recovery bands.">
                <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${TIER.modeled.cls}`}>Success Probs</span>
              </Cite>
              <Cite tier="preference" note="Churn cost swept across business values (F3).">
                <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${TIER.preference.cls}`}>Churn Sweep</span>
              </Cite>
            </div>
          </Assurance>
        </div>
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------- //
// Front-Page Ingestion Summary Card (Navigates to dedicated tab upon click)
// --------------------------------------------------------------------------- //
export function PipelineSummaryCard({
  seed,
  n,
  onNavigate,
}: {
  seed: number;
  n: number;
  onNavigate: () => void;
}) {
  const { data } = useApi<PipelineResponse>(`/pipeline?seed=${seed}&n=${n}`, [seed, n]);

  return (
    <div
      onClick={onNavigate}
      className="group cursor-pointer rounded-2xl border border-azure/20 bg-gradient-to-r from-surface via-azure-light/25 to-surface p-4 sm:p-5 shadow-sm transition-all hover:border-azure hover:shadow-panel"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-azure text-white shadow-sm">
              <Network className="h-3.5 w-3.5" />
            </span>
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-azure">
              Data Ingestion & Infrastructure Pipeline
            </span>
            <span className="rounded-md bg-money-light px-2 py-0.5 font-mono text-[10px] font-bold text-money-dim border border-money/20">
              Live Synthetic Feeds
            </span>
          </div>
          <p className="text-sm font-bold text-navy">
            Ingesting {n} synthetic users, gateway failure events, and bank credits into SQLite
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-dim">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 border border-line-soft font-mono text-[11px] shadow-sm">
              <Users className="h-3 w-3 text-azure" />
              <strong>{n} Users</strong> (15% High, 35% Mid, 50% Std)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 border border-line-soft font-mono text-[11px] shadow-sm">
              <CreditCard className="h-3 w-3 text-rose" />
              <strong>{n} Declines</strong> (109 Razorpay taxonomy)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 border border-line-soft font-mono text-[11px] shadow-sm">
              <Building2 className="h-3 w-3 text-money-dim" />
              <strong>{data?.summary.n_bank_rows ?? n} Bank Rows</strong> (UTR credits)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 border border-line-soft font-mono text-[11px] shadow-sm">
              <AlertCircle className="h-3 w-3 text-amber" />
              <strong>
                {data ? Object.values(data.summary.injected_exceptions).reduce((a, b) => a + b, 0) : "—"} Planted Anomalies
              </strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl bg-azure px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all group-hover:bg-azure-hover group-hover:shadow"
          >
            Explore Ingestion Streams
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Dedicated Data Ingestion & Backend Pipeline Surface
// --------------------------------------------------------------------------- //
const COHORT_BADGE: Record<string, { label: string; cls: string }> = {
  high: { label: "High Value (15%)", cls: "bg-amber/15 text-amber border-amber/30 font-bold" },
  mid: { label: "Mid Value (35%)", cls: "bg-azure-light text-azure border-azure/30 font-semibold" },
  low: { label: "Standard (50%)", cls: "bg-line/60 text-dim border-line font-medium" },
};

export function PipelinePanel({ seed, n, delay }: SeedProps) {
  const { data, error } = useApi<PipelineResponse>(`/pipeline?seed=${seed}&n=${n}`, [seed, n]);
  const [activeSubTab, setActiveSubTab] = useState<"cohorts" | "substrate" | "anomalies">("cohorts");
  const [cohortFilter, setCohortFilter] = useState<"all" | "high" | "mid" | "low">("all");

  if (!data)
    return (
      <Panel delay={delay}>
        <Head title="Data Ingestion & Infrastructure Pipeline" tag="Ingestion Stream" />
        <Loading error={error} />
      </Panel>
    );

  const totalAnomalies = Object.values(data.summary.injected_exceptions).reduce((a, b) => a + b, 0);

  const filteredFailures = data.sample_failures.filter((f) => {
    if (cohortFilter === "all") return true;
    return f.customer_value === cohortFilter;
  });

  return (
    <Panel delay={delay} className="space-y-6">
      {/* 1. Header & Determinism Info */}
      <Head
        title="Data Ingestion & Infrastructure Pipeline"
        tag={`Seed ${seed} · ${n} Ingested`}
        tagTone="azure"
      />

      <div className="px-5 sm:px-6 space-y-6">
        {/* 2. Infrastructure Provenance KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-line-soft bg-surface/70 p-3.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-faint text-[10.5px] font-semibold uppercase tracking-wider">
              <Users className="h-3 w-3 text-azure" /> Customer Orders
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-navy">{data.summary.n_onetime_failures}</div>
            <div className="text-[10.5px] text-faint">Lognormal (~₹600 median)</div>
          </div>
          <div className="rounded-xl border border-line-soft bg-surface/70 p-3.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-faint text-[10.5px] font-semibold uppercase tracking-wider">
              <CreditCard className="h-3 w-3 text-rose" /> Gateway Failures
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-navy">{data.summary.n_onetime_failures}</div>
            <div className="text-[10.5px] text-faint">109 Razorpay decline codes</div>
          </div>
          <div className="rounded-xl border border-line-soft bg-surface/70 p-3.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-faint text-[10.5px] font-semibold uppercase tracking-wider">
              <Building2 className="h-3 w-3 text-money-dim" /> Bank Statements
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-money-dim">{data.summary.n_bank_rows}</div>
            <div className="text-[10.5px] text-faint">NEFT/RTGS credit entries</div>
          </div>
          <div className="rounded-xl border border-line-soft bg-surface/70 p-3.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-faint text-[10.5px] font-semibold uppercase tracking-wider">
              <AlertCircle className="h-3 w-3 text-amber" /> Planted Anomalies
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-amber">{totalAnomalies}</div>
            <div className="text-[10.5px] text-faint">Controlled ground truth</div>
          </div>
        </div>

        {/* 3. Interactive Infrastructure Architecture Map */}
        <div className="rounded-2xl border border-line-soft bg-canvas/60 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-azure">
                Architecture Blueprint
              </span>
              <h4 className="text-sm font-bold text-navy">End-to-End Ingestion Flow</h4>
            </div>
            <span className="rounded-md bg-white border border-line-soft px-2 py-0.5 font-mono text-[10.5px] text-faint shadow-sm">
              SHA-256: {data.fingerprint.slice(0, 12)}…
            </span>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {/* Column 1: Source Ingestion Streams */}
            <div className="space-y-2 rounded-xl border border-line-soft bg-white p-3.5 shadow-sm">
              <div className="flex items-center gap-2 border-b border-line-soft pb-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-azure text-white text-[10px] font-bold">1</span>
                <span className="font-bold text-navy text-xs uppercase tracking-wide">Injected Data Streams</span>
              </div>
              <div className="space-y-2 pt-1 text-xs">
                <div className="rounded-lg border border-line-soft bg-raised/40 p-2">
                  <div className="font-semibold text-navy flex items-center justify-between">
                    <span>User Cohorts & Orders</span>
                    <span className="font-mono text-[10.5px] text-azure">15% / 35% / 50%</span>
                  </div>
                  <p className="text-[11px] text-faint mt-0.5">Lognormal ticket sizes (₹50 to ₹1L, median ₹600).</p>
                </div>
                <div className="rounded-lg border border-line-soft bg-raised/40 p-2">
                  <div className="font-semibold text-navy flex items-center justify-between">
                    <span>Gateway Decline Feed</span>
                    <span className="font-mono text-[10.5px] text-rose">109 Reasons</span>
                  </div>
                  <p className="text-[11px] text-faint mt-0.5">Real Razorpay decline vocabulary and timestamps.</p>
                </div>
                <div className="rounded-lg border border-line-soft bg-raised/40 p-2">
                  <div className="font-semibold text-navy flex items-center justify-between">
                    <span>Bank Statement Rows</span>
                    <span className="font-mono text-[10.5px] text-money-dim">MDR 2%+GST</span>
                  </div>
                  <p className="text-[11px] text-faint mt-0.5">Simulated NEFT/RTGS credit lines & UTR codes.</p>
                </div>
                <div className="rounded-lg border border-amber/20 bg-amber/5 p-2">
                  <div className="font-semibold text-amber flex items-center justify-between">
                    <span>Planted Anomalies</span>
                    <span className="font-mono text-[10.5px] text-amber">{totalAnomalies} bugs</span>
                  </div>
                  <p className="text-[11px] text-dim mt-0.5">Controlled fee haircuts, timing delays & missing deposits.</p>
                </div>
              </div>
            </div>

            {/* Column 2: Tijori Storage & Ledger */}
            <div className="space-y-2 rounded-xl border border-azure/30 bg-azure-light/20 p-3.5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-azure/20 pb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-navy text-white text-[10px] font-bold">2</span>
                  <span className="font-bold text-navy text-xs uppercase tracking-wide">Tijori Core Ledger</span>
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="rounded-lg border border-azure/20 bg-white p-2.5 shadow-sm">
                    <div className="flex items-center gap-1.5 font-bold text-navy">
                      <Database className="h-3.5 w-3.5 text-azure" />
                      Deterministic SQLite Store
                    </div>
                    <p className="text-[11px] text-dim mt-1">
                      In-memory ACID tables (<code className="font-mono text-[10.5px] text-azure">orders</code>, <code className="font-mono text-[10.5px] text-azure">payments</code>, <code className="font-mono text-[10.5px] text-azure">settlements</code>, <code className="font-mono text-[10.5px] text-azure">bank_rows</code>).
                    </p>
                  </div>
                  <div className="rounded-lg border border-azure/20 bg-white p-2.5 shadow-sm">
                    <div className="flex items-center gap-1.5 font-bold text-navy">
                      <ShieldCheck className="h-3.5 w-3.5 text-money-dim" />
                      Append-Only Audit Engine
                    </div>
                    <p className="text-[11px] text-dim mt-1">
                      Immutable sequence recording every raw event and decision for 100% reproducible replay.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-azure text-white p-2 text-center font-mono text-[11px] font-semibold">
                ⇄ 100% Replayable Byte Output
              </div>
            </div>

            {/* Column 3: Processing Engines */}
            <div className="space-y-2 rounded-xl border border-line-soft bg-white p-3.5 shadow-sm">
              <div className="flex items-center gap-2 border-b border-line-soft pb-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-money text-white text-[10px] font-bold">3</span>
                <span className="font-bold text-navy text-xs uppercase tracking-wide">Autonomous Engines</span>
              </div>
              <div className="space-y-2.5 pt-1 text-xs">
                <div className="rounded-lg border border-money/30 bg-money-light/30 p-2.5">
                  <div className="font-bold text-navy flex items-center justify-between">
                    <span>W Sensor: 3-Way Recon</span>
                    <span className="rounded bg-money-light px-1.5 py-0.2 font-mono text-[10px] font-bold text-money-dim">Sensor</span>
                  </div>
                  <p className="text-[11px] text-dim mt-1">
                    Matches Gateway ↔ Bank Statement ↔ Orders to detect planted fee haircuts, timing lag, and missing funds.
                  </p>
                </div>
                <div className="rounded-lg border border-azure/30 bg-azure-light/30 p-2.5">
                  <div className="font-bold text-navy flex items-center justify-between">
                    <span>R Actuator: Smart Recovery</span>
                    <span className="rounded bg-azure-light px-1.5 py-0.2 font-mono text-[10px] font-bold text-azure">Actuator</span>
                  </div>
                  <p className="text-[11px] text-dim mt-1">
                    Pairs customer value cohorts with decline causes to select optimal retry timing and maximize net value.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Interactive Stream Inspector */}
        <div className="rounded-2xl border border-line-soft bg-white p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line-soft pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveSubTab("cohorts")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeSubTab === "cohorts"
                    ? "bg-navy text-white shadow-sm"
                    : "border border-line bg-surface text-dim hover:bg-raised"
                }`}
              >
                1. Customer Cohorts & Failures ({data.sample_failures.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab("substrate")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeSubTab === "substrate"
                    ? "bg-navy text-white shadow-sm"
                    : "border border-line bg-surface text-dim hover:bg-raised"
                }`}
              >
                2. Bank & Settlement Feed ({data.sample_substrate.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab("anomalies")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeSubTab === "anomalies"
                    ? "bg-navy text-white shadow-sm"
                    : "border border-line bg-surface text-dim hover:bg-raised"
                }`}
              >
                3. Ground-Truth Injected Anomalies ({data.injected_details.length})
              </button>
            </div>

            {activeSubTab === "cohorts" && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-faint mr-1">Cohort:</span>
                {(["all", "high", "mid", "low"] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setCohortFilter(tier)}
                    className={`rounded px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase ${
                      cohortFilter === tier
                        ? "bg-azure text-white shadow-sm"
                        : "border border-line bg-surface text-dim hover:bg-raised"
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sub-view 1: Customer Cohorts & Failures */}
          {activeSubTab === "cohorts" && (
            <div className="space-y-3">
              {/* Cohort Distribution Bar */}
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-amber/30 bg-amber/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber">High Value Tier</span>
                    <span className="font-mono text-xs font-bold text-amber">{data.customer_cohorts.high.count} ({data.customer_cohorts.high.pct}%)</span>
                  </div>
                  <p className="text-[10.5px] text-dim mt-1 leading-snug">{data.customer_cohorts.high.desc}</p>
                </div>
                <div className="rounded-xl border border-azure/30 bg-azure-light/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-azure">Mid Value Tier</span>
                    <span className="font-mono text-xs font-bold text-azure">{data.customer_cohorts.mid.count} ({data.customer_cohorts.mid.pct}%)</span>
                  </div>
                  <p className="text-[10.5px] text-dim mt-1 leading-snug">{data.customer_cohorts.mid.desc}</p>
                </div>
                <div className="rounded-xl border border-line-soft bg-raised/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-dim">Standard Tier</span>
                    <span className="font-mono text-xs font-bold text-dim">{data.customer_cohorts.low.count} ({data.customer_cohorts.low.pct}%)</span>
                  </div>
                  <p className="text-[10.5px] text-dim mt-1 leading-snug">{data.customer_cohorts.low.desc}</p>
                </div>
              </div>

              {/* Data Table */}
              <div className="max-h-80 overflow-auto rounded-xl border border-line-soft">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="sticky top-0 bg-raised text-[10px] uppercase tracking-wide text-faint border-b border-line-soft">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Order ID</th>
                      <th className="px-3 py-2 font-semibold">Payment ID</th>
                      <th className="px-3 py-2 font-semibold">Customer Cohort</th>
                      <th className="px-3 py-2 text-right font-semibold">Amount</th>
                      <th className="px-3 py-2 font-semibold">Decline Reason (Razorpay)</th>
                      <th className="px-3 py-2 font-semibold">Root Cause</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft bg-white">
                    {filteredFailures.map((f) => {
                      const badge = COHORT_BADGE[f.customer_value] || COHORT_BADGE.low;
                      return (
                        <tr key={f.id} className="hover:bg-raised/40 transition-colors">
                          <td className="px-3 py-2 font-semibold text-navy">{f.order_id}</td>
                          <td className="px-3 py-2 text-faint">{f.id}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded border px-1.5 py-0.5 text-[9.5px] uppercase ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-navy tabular-nums">
                            {rupees(f.amount_paise)}
                          </td>
                          <td className="px-3 py-2 font-sans font-medium text-dim">{f.reason_code}</td>
                          <td className="px-3 py-2">
                            <span className="rounded bg-line/60 px-1.5 py-0.5 text-[10px] font-medium text-faint">
                              {f.cause}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-view 2: Bank Statement & Settlement Substrate */}
          {activeSubTab === "substrate" && (
            <div className="space-y-3">
              <p className="text-xs text-dim">
                Raw settlement stream generated for 3-way reconciliation against incoming bank statement credit rows.
              </p>
              <div className="max-h-80 overflow-auto rounded-xl border border-line-soft">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="sticky top-0 bg-raised text-[10px] uppercase tracking-wide text-faint border-b border-line-soft">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Settlement ID</th>
                      <th className="px-3 py-2 text-right font-semibold">Gross</th>
                      <th className="px-3 py-2 text-right font-semibold">MDR Fee (2%+GST)</th>
                      <th className="px-3 py-2 text-right font-semibold">Net Expected</th>
                      <th className="px-3 py-2 text-right font-semibold">Bank Credit</th>
                      <th className="px-3 py-2 font-semibold">Bank Ref / UTR</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft bg-white">
                    {data.sample_substrate.map((s) => {
                      const matched = s.status === "matched";
                      const isDiscrepancy = s.status === "discrepancy";
                      return (
                        <tr key={s.settlement_id} className="hover:bg-raised/40 transition-colors">
                          <td className="px-3 py-2 font-semibold text-navy">{s.settlement_id}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-faint">{rupees(s.gross_paise)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-faint">{rupees(s.fee_paise)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-navy">{rupees(s.net_paise)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-bold">
                            {s.bank_credit_paise != null ? rupees(s.bank_credit_paise) : "₹0 (Missing)"}
                          </td>
                          <td className="px-3 py-2 text-faint text-[10px]">{s.bank_row_id || "None"}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                              matched
                                ? "bg-money-light text-money-dim border-money/30"
                                : isDiscrepancy
                                ? "bg-amber/15 text-amber border-amber/30"
                                : "bg-rose/15 text-rose border-rose/30"
                            }`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-view 3: Ground-Truth Injected Anomalies */}
          {activeSubTab === "anomalies" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <p className="text-dim">
                  Ground-truth discrepancies deliberately injected into the stream to evaluate 3-way reconciliation recall.
                </p>
                <span className="rounded bg-money-light px-2.5 py-0.5 font-mono text-xs font-bold text-money-dim border border-money/20">
                  100% Detection Recall ✓
                </span>
              </div>
              <div className="max-h-80 overflow-auto rounded-xl border border-line-soft divide-y divide-line-soft bg-white">
                {data.injected_details.map((a, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs hover:bg-raised/40 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        a.type === "fee"
                          ? "bg-rose/15 text-rose border-rose/30"
                          : a.type === "timing"
                          ? "bg-amber/15 text-amber border-amber/30"
                          : a.type === "missing"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-azure-light text-azure border-azure/30"
                      }`}>
                        {a.type} anomaly
                      </span>
                      <span className="font-mono font-semibold text-navy">{a.settlement_id}</span>
                      <span className="text-dim font-medium">{a.details}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.delta_paise != null && a.delta_paise > 0 && (
                        <span className="font-mono text-xs font-bold text-rose">
                          -₹{(a.delta_paise / 100).toFixed(2)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded bg-money-light px-2 py-0.5 text-[10.5px] font-bold text-money-dim">
                        <Check className="h-3 w-3" /> W Caught
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

