import { rupees, pct, signed, useApi, useCountUp } from "./lib";

// --------------------------------------------------------------------------- //
// Shared primitives — hairline panels, terminal "field label" kickers, no
// nested cards. Elevation comes from borders, not shadows (the hero excepted).
// --------------------------------------------------------------------------- //
export function Panel({ children, className = "", delay = 0, hero = false }) {
  return (
    <section
      className={`animate-fade-up rounded-xl border border-line bg-surface ${
        hero ? "shadow-panel" : ""
      } ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </section>
  );
}

function Kicker({ children, className = "" }) {
  return (
    <p className={`font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-faint ${className}`}>
      {children}
    </p>
  );
}

function Head({ kicker, title, note, tag, tagTone = "muted" }) {
  const tones = {
    muted: "border-line text-muted",
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

function Loading({ error, label = "computing…" }) {
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
export function BatchPanel({ seed, n }) {
  const { data, error } = useApi(`/batch?seed=${seed}&n=${n}`, [seed, n]);
  const by = data ? Object.fromEntries(data.policies.map((p) => [p.policy, p])) : null;
  const smartPaise = by ? by.smart.gross_recovered_paise : 0;
  const counted = useCountUp(smartPaise);

  if (!data) return <Panel hero><Loading error={error} /></Panel>;
  const base = by.baseline, smart = by.smart, oracle = data.oracle_paise;

  const gauge = [
    { label: "Razorpay baseline", sub: "cited T+1 / T+2 / T+3, cause-blind", paise: base.gross_recovered_paise, eff: base.efficiency, color: "bg-amber", text: "text-amber" },
    { label: "Tijori smart", sub: "cause-aware · optimal-timing · net-value", paise: smart.gross_recovered_paise, eff: smart.efficiency, color: "bg-money", text: "text-money" },
  ];

  return (
    <Panel hero>
      <div className="grid gap-8 p-6 sm:p-7 lg:grid-cols-[1.05fr_1.35fr] lg:gap-10">
        {/* Left — the number */}
        <div className="flex flex-col justify-center">
          <Kicker>Net new revenue recovered · seed {data.seed} · n {data.n}</Kicker>
          <div className="mt-3 font-mono font-semibold leading-none tracking-tighter2 text-money text-[clamp(2.2rem,11vw,5rem)]">
            {rupees(Math.round(counted))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="rounded-md bg-money/10 px-2 py-1 font-mono font-semibold text-money">
              {signed(data.delta.gross_pct)}
            </span>
            <span className="text-muted">
              vs Razorpay's cited baseline — <span className="font-mono text-ink">{rupees(data.delta.gross_paise)}</span> more recovered
            </span>
          </div>
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-faint">
            Same seed → byte-identical output. Every figure below is a deterministic projection of
            one scored ledger; baseline and smart face identical keyed luck.
          </p>
        </div>

        {/* Right — the gauge + framing metrics */}
        <div className="flex flex-col justify-center gap-5">
          <div className="space-y-4">
            {gauge.map((g, i) => (
              <div key={g.label}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-ink">
                    {g.label} <span className="ml-1 text-xs font-normal text-faint">{g.sub}</span>
                  </span>
                  <span className={`font-mono text-sm font-semibold ${g.text}`}>{rupees(g.paise)}</span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-raised ring-1 ring-inset ring-line">
                  <div
                    className={`grow-x h-full rounded-full ${g.color}`}
                    style={{ width: `${(g.paise / oracle) * 100}%`, animationDelay: `${0.2 + i * 0.15}s` }}
                  />
                </div>
                <div className="mt-1 text-right font-mono text-[11px] text-faint">
                  {pct(g.eff)} of ceiling
                </div>
              </div>
            ))}
            {/* Oracle ceiling reference line */}
            <div className="flex items-center justify-between border-t border-dashed border-line pt-2.5 text-xs">
              <span className="flex items-center gap-2 text-muted">
                <span className="inline-block h-2 w-2 rounded-full bg-azure" />
                Oracle ceiling — knows the true WORLD probabilities
              </span>
              <span className="font-mono text-azure">{rupees(oracle)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
            <MiniStat label="Efficiency (F2)" value={pct(smart.efficiency)} tone="text-money" foot={`baseline ${pct(base.efficiency)}`} />
            <MiniStat label="Net-value gain (F3)" value={rupees(data.delta.net_paise)} foot="net of churn" />
            <MiniStat label="Fewer attempts" value={`−${base.n_attempts - smart.n_attempts}`} foot={`${smart.n_attempts} vs ${base.n_attempts}`} />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function MiniStat({ label, value, foot, tone = "text-ink" }) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <p className="text-[11px] text-faint">{label}</p>
      <p className={`mt-0.5 font-mono text-base font-semibold tabular-nums ${tone}`}>{value}</p>
      {foot && <p className="mt-0.5 font-mono text-[10.5px] text-faint">{foot}</p>}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// F1 — reconciliation as ground truth. The novel core → given prominence.
// --------------------------------------------------------------------------- //
export function LearnPanel({ seed, n, delay }) {
  const { data, error } = useApi(`/learn?seed=${seed}&n=${n}&batches=5`, [seed, n]);
  if (!data) return <Panel delay={delay}><Head kicker="F1 · closed learning loop" title="Reconciliation as ground truth" tag="novel core" tagTone="money" /><Loading error={error} /></Panel>;

  const W = 560, H = 210, padL = 40, padR = 14, padT = 16, padB = 26;
  const on = data.on, off = data.off;
  const nb = on.length;
  const x = (b) => padL + (b / (nb - 1 || 1)) * (W - padL - padR);
  const y = (eff) => padT + (1 - eff) * (H - padT - padB);
  const path = (rows) => rows.map((t, i) => `${i ? "L" : "M"}${x(t.batch)},${y(t.efficiency)}`).join(" ");
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
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((g) => (
              <g key={g}>
                <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="#232833" strokeWidth="1" />
                <text x={padL - 8} y={y(g) + 3} fontSize="10" fill="#7d8798" textAnchor="end" className="font-mono">{pct(g, 0)}</text>
              </g>
            ))}
            {on.map((t) => (
              <text key={t.batch} x={x(t.batch)} y={H - 8} fontSize="10" fill="#7d8798" textAnchor="middle" className="font-mono">B{t.batch}</text>
            ))}
            {/* flip marker */}
            {flipIdx > 0 && (
              <line x1={x(on[flipIdx].batch)} x2={x(on[flipIdx].batch)} y1={padT} y2={y(0)} stroke="#34d399" strokeWidth="1" strokeDasharray="2 4" opacity="0.5" />
            )}
            <path d={area} fill="url(#fillOn)" />
            {/* off — the ablation */}
            <path d={path(off)} fill="none" stroke="#4a5262" strokeWidth="2" strokeDasharray="4 4" />
            {/* on — recalibration */}
            <path d={path(on)} fill="none" stroke="#34d399" strokeWidth="2.5" className="draw-line" style={{ "--len": 700 }} />
            {on.map((t) => (
              <circle key={t.batch} cx={x(t.batch)} cy={y(t.efficiency)} r="4"
                fill={t.issuer_timing === "short" ? "#34d399" : "#f5b544"} stroke="#12151c" strokeWidth="2" />
            ))}
          </svg>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-faint">
            <Legend swatch="bg-money" label="recalibration on" />
            <Legend swatch="bg-[#4a5262]" label="off — never learns" dashed />
            <Legend dot="bg-amber" label="arm = fast (wrong)" />
            <Legend dot="bg-money" label="arm = short (world-optimal)" />
          </div>
        </div>

        <dl className="flex flex-col justify-center divide-y divide-line-soft">
          <Row term="issuer_soft timing">
            <span className="text-amber">{first.issuer_timing}</span>
            <span className="mx-2 text-faint">→</span>
            <span className="text-money">{last.issuer_timing}</span>
          </Row>
          <Row term="regret">
            <span className="text-muted">{rupees(first.regret_paise)}</span>
            <span className="mx-2 text-faint">→</span>
            <span className="text-money">{rupees(last.regret_paise)}</span>
          </Row>
          <Row term="mean Brier">
            <span className="text-muted">{first.mean_brier.toFixed(3)}</span>
            <span className="mx-2 text-faint">→</span>
            <span className="text-money">{last.mean_brier.toFixed(3)}</span>
          </Row>
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

function Legend({ swatch, dot, label, dashed }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch && <i className={`inline-block h-[3px] w-4 ${swatch} ${dashed ? "opacity-70" : ""}`} style={dashed ? { borderTop: "2px dashed #4a5262", background: "transparent", height: 0, width: 16 } : {}} />}
      {dot && <i className={`inline-block h-2 w-2 rounded-full ${dot}`} />}
      {label}
    </span>
  );
}

function Row({ term, children }) {
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
const EXC = {
  fee: { dot: "bg-sky", text: "text-sky", bg: "bg-sky/10" },
  timing: { dot: "bg-violet", text: "text-violet", bg: "bg-violet/10" },
  missing: { dot: "bg-rose", text: "text-rose", bg: "bg-rose/10" },
};

export function ExceptionsPanel({ seed, n, delay }) {
  const { data, error } = useApi(`/exceptions?seed=${seed}&n=${n}`, [seed, n]);
  if (!data) return <Panel delay={delay}><Head kicker="W · sensor" title="3-way reconciliation" tag="D4" /><Loading error={error} /></Panel>;
  const s = data.summary;

  return (
    <Panel delay={delay} className="flex flex-col">
      <Head kicker="W · sensor" title="3-way reconciliation" note="settlement ↔ bank ↔ orders · exact + tolerance match" tag="D4" />
      <div className="flex flex-wrap gap-1.5 px-5 py-3.5">
        {["fee", "timing", "missing"].map((t) => (
          <span key={t} className={`rounded-md px-2 py-1 font-mono text-[11px] font-medium ${EXC[t].bg} ${EXC[t].text}`}>
            {t} <span className="tabular-nums">{s.detected[t] ?? 0}</span>
          </span>
        ))}
        <span className="rounded-md bg-money/10 px-2 py-1 font-mono text-[11px] font-medium text-money">
          netting <span className="tabular-nums">{s.netting_reconciled}</span>
        </span>
        <span className="rounded-md bg-raised px-2 py-1 font-mono text-[11px] font-medium text-muted">
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
              <tr key={e.id} className="text-muted transition-colors hover:bg-raised/60">
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
export function ChurnPanel({ seed, n, delay }) {
  const { data, error } = useApi(`/churn?seed=${seed}&n=${n}`, [seed, n]);
  if (!data) return <Panel delay={delay}><Head kicker="F3 · net-value objective" title="Churn sensitivity" /><Loading error={error} /></Panel>;
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
export function OutcomeModelPanel({ delay }) {
  const { data, error } = useApi(`/outcome-model`, []);
  if (!data) return <Panel delay={delay}><Head kicker="honesty ledger" title="Outcome model" /><Loading error={error} /></Panel>;

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
const ACTOR = {
  R: "text-azure border-azure/30 bg-azure/10",
  W: "text-money border-money/30 bg-money/10",
  sim: "text-muted border-line bg-raised",
};

export function AuditPanel({ seed, n, delay }) {
  const { data, error } = useApi(`/audit?seed=${seed}&n=${n}&limit=200`, [seed, n]);
  if (!data) return <Panel delay={delay}><Head kicker="append-only" title="Audit trail" /><Loading error={error} /></Panel>;

  return (
    <Panel delay={delay}>
      <Head
        kicker="append-only · replayable by ₹ · insert-order deterministic"
        title="Audit trail"
        tag={`${data.total} events`}
      />
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
