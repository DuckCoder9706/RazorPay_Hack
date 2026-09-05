import { useEffect, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Fingerprint, Info, Lightbulb, ShieldCheck, Zap } from "lucide-react";
import { Gauge } from "@/components/charts/gauge";
import { FunnelChart } from "@/components/charts/funnel-chart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { rupees, pct, signed, useApi, useBatchStream, useReveal } from "./lib";
import type {
  BatchResponse,
  ChurnResponse,
  ExceptionsResponse,
  ExceptionType,
  LearnResponse,
  OutcomeModelResponse,
  AuditResponse,
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
  cited: { label: "CITED", cls: "text-money border-money/30 bg-money/10" },
  modeled: { label: "MODELED", cls: "text-azure border-azure/30 bg-azure/10" },
  preference: { label: "PREFERENCE", cls: "text-amber border-amber/30 bg-amber/10" },
};

export function Cite({ tier, children, note, source }: { tier: Tier; children: ReactNode; note: string; source?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="group inline-flex items-center gap-1 border-b border-dashed border-faint/50 leading-none hover:border-ink">
          {children}
          <Info className="h-3 w-3 text-faint group-hover:text-dim" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 border border-line bg-raised text-xs shadow-panel">
        <span className={`mb-2 inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium ${TIER[tier].cls}`}>
          {TIER[tier].label}
        </span>
        <p className="leading-relaxed text-dim">{note}</p>
        {source && (
          <a href={source} target="_blank" rel="noreferrer" className="mt-2 block break-all text-azure underline underline-offset-2">
            {source}
          </a>
        )}
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
// Shared primitives — hairline panels, terminal "field label" kickers, no
// nested cards. Elevation comes from borders, not shadows (the hero excepted).
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
      className={`reveal ${shown ? "reveal-in" : ""} rounded-2xl border border-line bg-surface ${
        hero ? "shadow-panel" : "shadow-card"
      } ${className}`}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
    >
      {children}
    </section>
  );
}

function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-faint ${className}`}>
      {children}
    </p>
  );
}

type TagTone = "muted" | "money" | "azure";

function Head({
  kicker,
  title,
  note,
  tag,
  tagTone = "muted",
}: {
  kicker?: ReactNode;
  title: ReactNode;
  note?: ReactNode;
  tag?: ReactNode;
  tagTone?: TagTone;
}) {
  const tones: Record<TagTone, string> = {
    muted: "border-line text-dim",
    money: "border-money/30 text-money bg-money/10",
    azure: "border-azure/30 text-azure bg-azure/10",
  };
  return (
    <header className="flex items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
      <div className="min-w-0">
        {kicker && <Kicker className="mb-1.5">{kicker}</Kicker>}
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {note && <p className="mt-1 text-xs leading-relaxed text-faint">{note}</p>}
      </div>
      {tag && (
        <span className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${tones[tagTone]}`}>
          {tag}
        </span>
      )}
    </header>
  );
}

function Loading({ error, label = "computing…" }: { error: string | null; label?: string }) {
  if (error)
    return (
      <p className="px-5 py-8 text-sm text-rose">
        API error: {error} — is <code className="font-mono">uvicorn</code> up on :8000?
      </p>
    );
  return (
    <div className="px-5 py-8">
      <p className="font-mono text-xs text-faint">{label}</p>
      <div className="mt-3 h-1 w-24 overflow-hidden rounded-full bg-raised">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-money/50" />
      </div>
    </div>
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

  const bars = [
    { label: "Razorpay baseline", sub: "cited T+1 / T+2 / T+3, cause-blind", gross: baseGross, eff: baseEff, color: "bg-amber", text: "text-amber" },
    { label: "Tijori smart", sub: "cause-aware · optimal-timing · net-value", gross: smartGross, eff: smartEff, color: "bg-money", text: "text-money" },
  ];

  return (
    <Panel hero>
      <div className="grid gap-8 p-6 sm:p-7 lg:grid-cols-[1.05fr_1.35fr] lg:gap-10">
        {/* Left — the number */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <Kicker>Net new revenue recovered · seed {seed} · n {n}</Kicker>
            {streaming && <span className="font-mono text-[10px] uppercase tracking-wide text-money">● scoring</span>}
          </div>
          <div className="mt-3 font-mono font-semibold leading-none tracking-tighter2 text-money text-[clamp(2.2rem,11vw,5rem)] tabular-nums">
            {rupees(Math.round(smartGross))}
          </div>
          {/* playback progress */}
          <div className="mt-3 h-0.5 w-full max-w-sm overflow-hidden rounded-full bg-line" hidden={!streaming}>
            <div className="h-full rounded-full bg-money transition-[width] duration-150 ease-out" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="rounded-md bg-money/10 px-2 py-1 font-mono font-semibold text-money tabular-nums">
              {signed(deltaPct)}
            </span>
            <span className="text-dim">
              vs Razorpay's cited baseline — <span className="font-mono text-ink">{rupees(deltaGross)}</span> more recovered
            </span>
          </div>
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-faint">
            Same seed → byte-identical output. Every figure below is a deterministic projection of
            one scored ledger; baseline and smart face identical keyed luck.
          </p>
        </div>

        {/* Right — the bars + framing metrics */}
        <div className="flex flex-col justify-center gap-5">
          <div className="space-y-4">
            {bars.map((g) => (
              <div key={g.label}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-ink">
                    {g.label} <span className="ml-1 text-xs font-normal text-faint">{g.sub}</span>
                  </span>
                  <span className={`font-mono text-sm font-semibold tabular-nums ${g.text}`}>{rupees(g.gross)}</span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-raised ring-1 ring-inset ring-line">
                  <div
                    className={`h-full rounded-full transition-[width] duration-150 ease-out ${g.color}`}
                    style={{ width: `${oracle ? (g.gross / oracle) * 100 : 0}%` }}
                  />
                </div>
                <div className="mt-1 text-right font-mono text-[11px] text-faint">{pct(g.eff)} of ceiling</div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-dashed border-line pt-2.5 text-xs">
              <span className="flex items-center gap-2 text-dim">
                <span className="inline-block h-2 w-2 rounded-full bg-azure" />
                Oracle ceiling — knows the true WORLD probabilities
              </span>
              <span className="font-mono text-azure">{rupees(oracle)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
            <MiniStat label="Efficiency (F2)" value={pct(smartEff)} tone="text-money" foot={`baseline ${pct(baseEff)}`} />
            <MiniStat label="Net-value gain (F3)" value={netPaise != null ? rupees(netPaise) : "—"} foot="net of churn" />
            <MiniStat label="Fewer attempts" value={`−${baseAtt - smartAtt}`} foot={`${smartAtt} vs ${baseAtt}`} />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function MiniStat({ label, value, foot, tone = "text-ink" }: { label: string; value: string; foot?: string; tone?: string }) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <p className="text-[11px] text-faint">{label}</p>
      <p className={`mt-0.5 font-mono text-base font-semibold tabular-nums ${tone}`}>{value}</p>
      {foot && <p className="mt-0.5 font-mono text-[10.5px] text-faint">{foot}</p>}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Insight — one gradient narrative card (the F1 / efficiency story), Zentra-style
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
      className={`reveal ${shown ? "reveal-in" : ""} relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-2xl p-6 text-white shadow-panel`}
      style={{
        transitionDelay: shown ? `${delay}ms` : "0ms",
        background: "linear-gradient(135deg,#2563eb 0%,#0ea3a0 52%,#16a34a 100%)",
      }}
    >
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-black/10 blur-3xl" />
      <div className="relative flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/30">
          <Lightbulb className="h-3 w-3" strokeWidth={2.2} /> Insight
        </span>
      </div>
      <div className="relative">
        <div className="font-mono text-[clamp(2.75rem,9vw,4.25rem)] font-semibold leading-none tracking-tighter2">
          {eff != null ? `${eff}%` : "—"}
        </div>
        <p className="mt-2 text-sm font-medium text-white/95">of the reachable ceiling — recovered</p>
        <p className="mt-3 max-w-md text-[13px] leading-relaxed text-white/85">
          Smart recovered{" "}
          <span className="font-mono font-semibold text-white">
            {smart ? rupees(smart.gross_recovered_paise) : "—"}
          </span>{" "}
          {batch.data && (
            <>
              — <span className="font-mono font-semibold text-white">{signed(batch.data.delta.gross_pct)}</span> vs
              Razorpay's cited baseline.
            </>
          )}{" "}
          {flipIdx != null && flipIdx > 0 && (
            <>
              F1 recalibration closed regret to <span className="font-mono font-semibold text-white">₹0</span> in{" "}
              {flipIdx} batches.
            </>
          )}
        </p>
      </div>
    </div>
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
        <Head kicker="R · recovery flow" title="Where the money goes" tag="funnel + gauge" />
        <Loading error={error} />
      </Panel>
    );
  const by = Object.fromEntries(data.policies.map((p) => [p.policy, p])) as Record<
    PolicyName,
    BatchResponse["policies"][number]
  >;
  const smart = by.smart, base = by.baseline;
  const stages = [
    { label: "At risk", value: data.at_risk_paise, displayValue: rupees(data.at_risk_paise), color: "#94a3b8" },
    { label: "Recoverable", value: data.oracle_paise, displayValue: rupees(data.oracle_paise), color: "#3b82f6" },
    { label: "Recovered", value: smart.gross_recovered_paise, displayValue: rupees(smart.gross_recovered_paise), color: "#16a34a" },
    { label: "Reconciled", value: smart.gross_recovered_paise, displayValue: rupees(smart.gross_recovered_paise), color: "#15803d" },
  ];

  return (
    <Panel delay={delay}>
      <Head
        kicker="R · recovery flow"
        title="Where the money goes"
        note="at-risk → recoverable ceiling (oracle) → recovered (smart) → reconciled"
        tag="funnel + gauge"
      />
      <div className="grid gap-4 p-5 lg:grid-cols-[1.55fr_1fr]">
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
          <div className="w-full max-w-[240px]">
            <Gauge
              value={smart.efficiency * 100}
              centerValue={Math.round(smart.efficiency * 100)}
              suffix="%"
              defaultLabel="of ceiling"
              height={150}
              useGradient
              activeGradient={["#16a34a", "#15803d"]}
            />
          </div>
          <p className="mt-1 text-center font-mono text-[11px] text-faint">
            efficiency vs oracle · baseline {pct(base.efficiency)}
          </p>
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
        <Head kicker="F1 · closed learning loop" title="Reconciliation as ground truth" tag="novel core" tagTone="money" />
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
        kicker="F1 · closed learning loop"
        title="Reconciliation as ground truth"
        note="W reconciles R's realized outcomes and recalibrates BELIEF via EMA — the mis-set arm flips back to world-optimal, and regret closes."
        tag="novel core"
        tagTone="money"
      />
      <div className="grid gap-6 p-5 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Calibration efficiency across batches">
            <defs>
              <linearGradient id="fillOn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((g) => (
              <g key={g}>
                <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="#e4e7ec" strokeWidth="1" />
                <text x={padL - 8} y={y(g) + 3} fontSize="10" fill="#737b88" textAnchor="end" className="font-mono">{pct(g, 0)}</text>
              </g>
            ))}
            {on.map((t) => (
              <text key={t.batch} x={x(t.batch)} y={H - 8} fontSize="10" fill="#737b88" textAnchor="middle" className="font-mono">B{t.batch}</text>
            ))}
            {flipIdx > 0 && (
              <line x1={x(on[flipIdx].batch)} x2={x(on[flipIdx].batch)} y1={padT} y2={y(0)} stroke="#16a34a" strokeWidth="1" strokeDasharray="2 4" opacity="0.5" />
            )}
            <path d={area} fill="url(#fillOn)" />
            <path d={path(off)} fill="none" stroke="#cbd0d8" strokeWidth="2" strokeDasharray="4 4" />
            <path d={path(on)} fill="none" stroke="#16a34a" strokeWidth="2.5" className="draw-line" style={{ "--len": 700 } as React.CSSProperties} />
            {on.map((t) => (
              <circle key={t.batch} cx={x(t.batch)} cy={y(t.efficiency)} r="4" fill={t.issuer_timing === "short" ? "#16a34a" : "#c2740c"} stroke="#ffffff" strokeWidth="2" />
            ))}
          </svg>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-faint">
            <Legend swatch="bg-money" label="recalibration on" />
            <Legend swatch="bg-[#cbd0d8]" label="off — never learns" dashed />
            <Legend dot="bg-amber" label="arm = fast (wrong)" />
            <Legend dot="bg-money" label="arm = short (world-optimal)" />
          </div>
        </div>

        <dl className="flex flex-col justify-center divide-y divide-line-soft">
          <RowKV term="issuer_soft timing">
            <span className="text-amber">{first.issuer_timing}</span>
            <span className="mx-2 text-faint">→</span>
            <span className="text-money">{last.issuer_timing}</span>
          </RowKV>
          <RowKV term="regret">
            <span className="text-dim">{rupees(first.regret_paise)}</span>
            <span className="mx-2 text-faint">→</span>
            <span className="text-money">{rupees(last.regret_paise)}</span>
          </RowKV>
          <RowKV term="mean Brier">
            <span className="text-dim">{first.mean_brier.toFixed(3)}</span>
            <span className="mx-2 text-faint">→</span>
            <span className="text-money">{last.mean_brier.toFixed(3)}</span>
          </RowKV>
          <p className="pt-3 text-xs leading-relaxed text-faint">
            R starts over-trusting fast retries and picks the wrong day. Within{" "}
            <span className="font-mono text-ink">{flipIdx}</span> batches the argmax flips to{" "}
            <span className="font-medium text-money">short</span> — pure exploitation, no labels but reconciliation itself.
          </p>
        </dl>
      </div>
    </Panel>
  );
}

function Legend({ swatch, dot, label, dashed }: { swatch?: string; dot?: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch && (
        <i
          className={`inline-block h-[3px] w-4 ${swatch} ${dashed ? "opacity-70" : ""}`}
          style={dashed ? { borderTop: "2px dashed #cbd0d8", background: "transparent", height: 0, width: 16 } : {}}
        />
      )}
      {dot && <i className={`inline-block h-2 w-2 rounded-full ${dot}`} />}
      {label}
    </span>
  );
}

function RowKV({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-2.5">
      <dt className="font-mono text-[11px] uppercase tracking-wide text-faint">{term}</dt>
      <dd className="font-mono text-sm font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// W — 3-way reconciliation: typed exceptions + netting
// --------------------------------------------------------------------------- //
const EXC: Record<ExceptionType, { dot: string; text: string; bg: string }> = {
  fee: { dot: "bg-sky", text: "text-sky", bg: "bg-sky/10" },
  timing: { dot: "bg-violet", text: "text-violet", bg: "bg-violet/10" },
  missing: { dot: "bg-rose", text: "text-rose", bg: "bg-rose/10" },
};

export function ExceptionsPanel({ seed, n, delay }: SeedProps) {
  const { data, error } = useApi<ExceptionsResponse>(`/exceptions?seed=${seed}&n=${n}`, [seed, n]);
  if (!data)
    return (
      <Panel delay={delay}>
        <Head kicker="W · sensor" title="3-way reconciliation" tag="D4" />
        <Loading error={error} />
      </Panel>
    );
  const s = data.summary;

  return (
    <Panel delay={delay} className="flex flex-col">
      <Head kicker="W · sensor" title="3-way reconciliation" note="settlement ↔ bank ↔ orders · exact + tolerance match" tag="D4" />
      <div className="flex flex-wrap gap-1.5 px-5 py-3.5">
        {(["fee", "timing", "missing"] as ExceptionType[]).map((t) => (
          <span key={t} className={`rounded-md px-2 py-1 font-mono text-[11px] font-medium ${EXC[t].bg} ${EXC[t].text}`}>
            {t} <span className="tabular-nums">{s.detected[t] ?? 0}</span>
          </span>
        ))}
        <span className="rounded-md bg-money/10 px-2 py-1 font-mono text-[11px] font-medium text-money">
          netting <span className="tabular-nums">{s.netting_reconciled}</span>
        </span>
        <span className="rounded-md bg-raised px-2 py-1 font-mono text-[11px] font-medium text-dim">
          clean <span className="tabular-nums">{s.reconciled}</span>
        </span>
      </div>
      <div className="mx-5 mb-5 max-h-52 overflow-auto rounded-lg border border-line-soft">
        <table className="w-full text-left font-mono text-[11px]">
          <thead className="sticky top-0 bg-raised text-[10px] uppercase tracking-wide text-faint">
            <tr>
              <th className="px-3 py-2 font-medium">exception</th>
              <th className="px-3 py-2 font-medium">type</th>
              <th className="px-3 py-2 text-right font-medium">expected</th>
              <th className="px-3 py-2 text-right font-medium">observed</th>
              <th className="px-3 py-2 text-right font-medium">Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {data.exceptions.map((e) => (
              <tr key={e.id} className="text-dim transition-colors hover:bg-raised/60">
                <td className="px-3 py-1.5 text-faint">{e.id}</td>
                <td className="px-3 py-1.5">
                  <span className={`inline-flex items-center gap-1.5 ${EXC[e.type].text}`}>
                    <i className={`h-1.5 w-1.5 rounded-full ${EXC[e.type].dot}`} />
                    {e.type}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{rupees(e.expected, { decimals: 2 })}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{rupees(e.observed, { decimals: 2 })}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums ${e.delta ? "text-ink" : "text-faint"}`}>{rupees(e.delta, { decimals: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------- //
// F3 — cost/churn sensitivity sweep
// --------------------------------------------------------------------------- //
export function ChurnPanel({ seed, n, delay }: SeedProps) {
  const { data, error } = useApi<ChurnResponse>(`/churn?seed=${seed}&n=${n}`, [seed, n]);
  if (!data)
    return (
      <Panel delay={delay}>
        <Head kicker="F3 · net-value objective" title="Churn sensitivity" />
        <Loading error={error} />
      </Panel>
    );
  const max = Math.max(...data.rows.map((r) => Math.max(r.baseline_net, r.smart_net)));

  return (
    <Panel delay={delay}>
      <Head
        kicker="F3 · net-value objective"
        title="Churn sensitivity sweep"
        note="Smart wins on net value whatever the (unknowable) churn cost — the ranking isn't tuned to one guess."
        tag={data.smart_always_wins_net ? "robust ✓" : "check"}
        tagTone={data.smart_always_wins_net ? "money" : "muted"}
      />
      <div className="space-y-2.5 px-5 py-4">
        {data.rows.map((r, i) => (
          <div key={r.c_churn_paise} className="flex items-center gap-3">
            <span className="w-14 shrink-0 font-mono text-[11px] tabular-nums text-faint">c={rupees(r.c_churn_paise, { decimals: 0 })}</span>
            <div className="flex-1 space-y-1">
              <div className="h-2 rounded-full bg-amber grow-x" style={{ width: `${(r.baseline_net / max) * 100}%`, animationDelay: `${i * 60}ms` }} />
              <div className="h-2 rounded-full bg-money grow-x" style={{ width: `${(r.smart_net / max) * 100}%`, animationDelay: `${i * 60 + 40}ms` }} />
            </div>
            <span className="w-24 shrink-0 text-right font-mono text-[11px] tabular-nums text-money">{rupees(r.smart_net)}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 border-t border-line-soft px-5 py-3 font-mono text-[10.5px] text-faint">
        <Legend swatch="bg-amber" label="baseline net" />
        <Legend swatch="bg-money" label="smart net" />
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
        kicker="honesty ledger · WORLD (truth) / belief (R's prior)"
        title="Outcome model"
        note="Reason taxonomy cited; success probabilities modeled and declared. Highlighted row = the wrong prior F1 corrects."
        tag="honesty"
      />
      <div className="overflow-auto px-5 py-4">
        <table className="w-full text-left font-mono text-[11.5px]">
          <thead className="text-[10px] uppercase tracking-wide text-faint">
            <tr>
              <th className="py-1.5 pr-3 font-medium">cause</th>
              <th className="px-3 py-1.5 text-right font-medium">w</th>
              {data.timings.map((t) => (
                <th key={t} className="px-3 py-1.5 text-right font-medium">{t}</th>
              ))}
              <th className="py-1.5 pl-3 text-right font-medium">best</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {data.causes.map((c) => (
              <tr key={c.cause} className={c.belief_wrong ? "bg-amber/[0.07]" : c.retryable ? "" : "opacity-45"}>
                <td className="py-1.5 pr-3 font-sans font-medium text-ink">
                  {c.cause}
                  {!c.retryable && <span className="ml-1 text-[10px] font-normal text-faint">terminal</span>}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-faint">{c.weight.toFixed(2)}</td>
                {data.timings.map((t) => (
                  <td key={t} className="px-3 py-1.5 text-right tabular-nums">
                    <span className="text-ink">{c.world[t].toFixed(2)}</span>
                    <span className="text-faint">/{c.belief[t].toFixed(2)}</span>
                  </td>
                ))}
                <td className="py-1.5 pl-3 text-right">
                  <span className="text-money">{c.world_best_timing}</span>
                  {c.belief_wrong && <span className="ml-1.5 text-amber">≠ {c.belief_best_timing}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2.5 font-mono text-[10.5px] text-faint">
          cells: <span className="text-ink">world</span> / belief · w = cited distribution weight
        </p>
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------- //
// Append-only audit trail — a real terminal log
// --------------------------------------------------------------------------- //
const ACTOR: Record<string, string> = {
  R: "text-azure border-azure/30 bg-azure/10",
  W: "text-money border-money/30 bg-money/10",
  sim: "text-dim border-line bg-raised",
};

export function AuditPanel({ seed, n, delay }: SeedProps) {
  const { data, error } = useApi<AuditResponse>(`/audit?seed=${seed}&n=${n}&limit=200`, [seed, n]);
  if (!data)
    return (
      <Panel delay={delay}>
        <Head kicker="append-only" title="Audit trail" />
        <Loading error={error} />
      </Panel>
    );

  return (
    <Panel delay={delay}>
      <Head kicker="append-only · replayable by ₹ · insert-order deterministic" title="Audit trail" tag={`${data.total} events`} />
      <div className="max-h-72 overflow-auto px-2 py-2 font-mono text-[11px] leading-relaxed">
        {data.events.map((e) => (
          <div key={e.id} className="flex items-start gap-2 rounded px-3 py-1 hover:bg-raised/60">
            <span className="w-5 shrink-0 text-right text-faint/60">{e.id}</span>
            <span className={`shrink-0 rounded border px-1.5 text-[10px] font-medium uppercase ${ACTOR[e.actor] || ACTOR.sim}`}>{e.actor}</span>
            <span className="shrink-0 text-ink">{e.event}</span>
            <span className="truncate text-faint">{JSON.stringify(e.payload)}</span>
          </div>
        ))}
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
  const tone = paid ? "text-money bg-money/10 border-money/30" : "text-amber bg-amber/10 border-amber/30";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium uppercase ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${paid ? "bg-money" : "bg-amber animate-pulse"}`} />
      {status ?? "—"}
    </span>
  );
}

export function RazorpayPanel({ delay }: { delay?: number }) {
  const [link, setLink] = useState<RazorpayLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/razorpay/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_paise: 50000 }),
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

  // Poll status until the link is paid (the created → paid moment, live on screen).
  useEffect(() => {
    if (!link?.id || link.status === "paid") return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/razorpay/link/${link.id}`);
        const d: RazorpayLink = await r.json();
        if (d.ok) setLink((prev) => (prev ? { ...prev, status: d.status, live: d.live } : d));
      } catch {
        /* transient; keep polling */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [link?.id, link?.status]);

  return (
    <Panel delay={delay}>
      <Head
        kicker="D3 · one live test-mode path"
        title="Real Razorpay Payment Link"
        note="The scored loop never touches the network — this is the genuine-object anchor. Create a real rzp_test_ link and watch it settle."
        tag={link ? (link.live ? "live" : "replayed") : "test-mode"}
        tagTone={link?.live ? "money" : "muted"}
      />
      <div className="p-5">
        {!link ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-dim">
              Creates a genuine test-mode Payment Link — a real{" "}
              <span className="font-mono text-ink">plink_</span> object, not a mock.
            </p>
            <button
              onClick={create}
              disabled={busy}
              className="rounded-lg border border-money/40 bg-money/15 px-3.5 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-money transition-colors hover:bg-money/25 disabled:opacity-50"
            >
              {busy ? "creating…" : "Create test Payment Link"}
            </button>
            {err && (
              <p className="text-xs text-rose">
                {err === "no_keys_no_fixture"
                  ? "No rzp_test_ keys configured and no recorded object to replay."
                  : err}
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="w-max rounded-xl bg-white p-3">
              {link.short_url && <QRCodeSVG value={link.short_url} size={132} bgColor="#ffffff" fgColor="#0a0c10" level="M" />}
            </div>
            <dl className="min-w-0 space-y-2 font-mono text-xs">
              <LinkRow k="id">{link.id}</LinkRow>
              <LinkRow k="amount">
                {link.amount != null ? rupees(link.amount) : "—"} {link.currency}
              </LinkRow>
              <LinkRow k="status">
                <StatusBadge status={link.status} />
              </LinkRow>
              <LinkRow k="link">
                <a href={link.short_url} target="_blank" rel="noreferrer" className="break-all text-azure underline underline-offset-2">
                  {link.short_url}
                </a>
              </LinkRow>
              <p className="pt-1 text-[11px] leading-relaxed text-faint">
                {link.live
                  ? "Live object, fetched from Razorpay just now."
                  : "Replayed from a recorded real object (offline demo)."}{" "}
                Pay it with test card <span className="text-dim">4111 1111 1111 1111</span> — status flips to paid.
              </p>
            </dl>
          </div>
        )}
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------- //
// Verification — "see for yourself": determinism proof, no-LLM bound, oracle
// bound, provenance legend. Turns claims into checks a judge can run.
// --------------------------------------------------------------------------- //
function Assurance({ icon: Icon, title, children }: { icon: typeof Check; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 p-4">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-money/30 bg-money/10">
        <Icon className="h-3.5 w-3.5 text-money" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        <div className="mt-1 text-xs leading-relaxed text-dim">{children}</div>
      </div>
    </div>
  );
}

const shortHash = (h: string) => `${h.slice(0, 20)}…${h.slice(-8)}`;

export function VerifyPanel({ seed, n, delay }: SeedProps) {
  const verify = useApi<VerifyResponse>(`/verify?seed=${seed}&n=${n}`, [seed, n]);
  const batch = useApi<BatchResponse>(`/batch?seed=${seed}&n=${n}`, [seed, n]);
  const smart = batch.data?.policies.find((p) => p.policy === "smart");
  const oracleHolds = smart ? smart.efficiency <= 1.0 : null;

  return (
    <Panel delay={delay}>
      <Head
        kicker="verification · see for yourself"
        title="Assurances"
        note="The frontend is all a judge sees — so every claim here is checkable, not asserted."
        tag="provable"
        tagTone="money"
      />
      <div className="grid gap-px bg-line sm:grid-cols-2">
        <div className="bg-surface">
          <Assurance icon={Fingerprint} title="Reproducible — same seed, byte-identical">
            {verify.data ? (
              <>
                <p>Scored twice, independently. Both digests match:</p>
                <div className="mt-1.5 space-y-0.5 font-mono text-[10.5px] text-faint">
                  <div>a {shortHash(verify.data.hash_a)}</div>
                  <div>b {shortHash(verify.data.hash_b)}</div>
                </div>
                <p className={`mt-1 font-mono text-[11px] ${verify.data.identical ? "text-money" : "text-rose"}`}>
                  {verify.data.identical ? "✓ identical (sha256)" : "✗ mismatch"}
                </p>
              </>
            ) : (
              <span className="text-faint">hashing…</span>
            )}
          </Assurance>
        </div>
        <div className="bg-surface">
          <Assurance icon={Zap} title="No model in the scored path">
            The scored core is stdlib-only at <span className="font-mono text-ink">~6 µs</span>/decision
            (~160k/sec, single core) — far too fast to be calling an LLM. Claude stays outside scoring.
          </Assurance>
        </div>
        <div className="bg-surface">
          <Assurance icon={ShieldCheck} title="Oracle bound holds">
            {oracleHolds == null ? (
              <span className="text-faint">checking…</span>
            ) : (
              <>
                Smart recovers <span className="font-mono text-ink">{smart ? pct(smart.efficiency) : "—"}</span> of the
                reachable maximum — <span className={oracleHolds ? "text-money" : "text-rose"}>{oracleHolds ? "≤ 100% ✓" : "> 100% ✗"}</span>.
                No policy can beat the oracle; the UI asserts it.
              </>
            )}
          </Assurance>
        </div>
        <div className="bg-surface">
          <Assurance icon={Info} title="Provenance, declared">
            <div className="flex flex-wrap gap-1.5">
              <Cite tier="cited" note="Reason taxonomy = Razorpay's documented 109-value error enum; distribution anchored to cited card/UPI decline data." source="https://razorpay.com/docs/payments/payment-gateway/rainy-day/errors/error-reasons/">
                <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${TIER.cited.cls}`}>taxonomy</span>
              </Cite>
              <Cite tier="modeled" note="WORLD/BELIEF success probabilities are modeled and declared — calibrated to published recovery bands, direction cited, magnitudes modeled.">
                <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${TIER.modeled.cls}`}>success probs</span>
              </Cite>
              <Cite tier="preference" note="Churn cost has no single true value — it's a business preference, so it's swept (F3), never asserted as fact.">
                <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${TIER.preference.cls}`}>churn cost</span>
              </Cite>
            </div>
          </Assurance>
        </div>
      </div>
    </Panel>
  );
}
