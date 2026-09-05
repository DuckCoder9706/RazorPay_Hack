"use client";

import { useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  Activity,
  Sparkles,
  Layers,
  TrendingUp,
} from "lucide-react";
import type { ReconInfrastructure, ReconTrendPoint } from "../../types";
import { pct, rupees } from "../../lib";

interface ReconBenchmarkVisualizerProps {
  infrastructures: ReconInfrastructure[];
  selectedId: string;
  onSelectId: (id: string) => void;
  totalVolumePaise: number;
  trend: ReconTrendPoint[];
  seed: number;
  n: number;
  sonicSavingsVsDefault: number;
}

interface RadarDimension {
  key: string;
  name: string;
  shortName: string;
  description: string;
  getScore: (infra: ReconInfrastructure) => number;
  getFormatted: (infra: ReconInfrastructure) => string;
}

const RADAR_DIMENSIONS: RadarDimension[] = [
  {
    key: "recon_rate",
    name: "Auto-Reconciliation Rate",
    shortName: "Match Rate",
    description: "Percentage of transactions matched autonomously without manual review.",
    getScore: (i) => Math.min(1, Math.max(0.1, i.reconciliation_rate)),
    getFormatted: (i) => pct(i.reconciliation_rate),
  },
  {
    key: "speed",
    name: "Settlement Velocity",
    shortName: "Velocity",
    description: "Settlement speed from gateway capture to bank statement deposit (T+0 vs T+2/T+7).",
    getScore: (i) => {
      if (i.latency_hours <= 0.1) return 0.98;
      if (i.latency_hours <= 24) return 0.78;
      if (i.latency_hours <= 48) return 0.58;
      return 0.22;
    },
    getFormatted: (i) => i.latency_label.split(" ")[0] || "T+2",
  },
  {
    key: "netting",
    name: "Many-to-Many Netting Recall",
    shortName: "Netting",
    description: "Resolution of batched bank-credit lumps into individual merchant settlements. Sonic is measured (100% on the ledger); other rails are a qualitative estimate scaled from their auto-match rate (none resolve NPCI-style circular netting natively).",

    getScore: (i) => (i.id === "sonic" ? 1.0 : Math.max(0.15, i.reconciliation_rate - 0.25)),
    getFormatted: (i) => (i.id === "sonic" ? "100% (measured)" : `~${Math.round(Math.max(0.15, i.reconciliation_rate - 0.25) * 100)}% (est.)`),
  },
  {
    key: "determinism",
    name: "Audit Reproducibility",
    shortName: "Determinism",
    description: "Byte-for-byte reproducibility of the audit trail under replay. Sonic is measured (SHA-256 dual-run identical, /verify); other rails are rated qualitatively by audit architecture (log/SQL vs manual CSV).",

    getScore: (i) => {
      if (i.id === "sonic") return 1.0;
      if (i.category === "legacy") return 0.35;
      return 0.8;
    },
    getFormatted: (i) => {
      if (i.id === "sonic") return "SHA-256 (measured)";
      if (i.category === "legacy") return "Manual CSV (est.)";
      return "System logs (est.)";
    },
  },
  {
    key: "leakage_protection",
    name: "Fee Haircut & Leakage Prevention",
    shortName: "Protection",
    description: "Elimination of unrecovered bank fee deductions (MDR/GST slippage).",
    getScore: (i) => Math.max(0.15, 1 - i.leakage_basis_points / 300),
    getFormatted: (i) => (i.leakage_basis_points === 0 ? "0 bps (Zero Drag)" : `${i.leakage_basis_points} bps drag`),
  },
  {
    key: "autonomous",
    name: "Hands-Off Automation",
    shortName: "Hands-Off",
    description: "Freedom from manual spreadsheet reconciliation and manual dispute filing.",
    getScore: (i) => Math.max(0.15, 1 - i.manual_touch_pct / 32),
    getFormatted: (i) => `${(100 - i.manual_touch_pct).toFixed(1)}% Automated`,
  },
];

export function ReconBenchmarkVisualizer({
  infrastructures,
  selectedId,
  onSelectId,
  totalVolumePaise,
  trend,
  seed,
  n,
  sonicSavingsVsDefault,
}: ReconBenchmarkVisualizerProps) {

  const [viewMode, setViewMode] = useState<"radar" | "trend">("radar");
  const [hoveredDimIdx, setHoveredDimIdx] = useState<number | null>(null);
  const [showSonicOverlay, setShowSonicOverlay] = useState<boolean>(true);
  const [trendMetric, setTrendMetric] = useState<"rate" | "leakage">("rate");

  const selectedInfra =
    infrastructures.find((i) => i.id === selectedId) || infrastructures[0];
  const sonicInfra =
    infrastructures.find((i) => i.id === "sonic") || infrastructures[0];

  const cx = 230;
  const cy = 190;
  const maxR = 135;

  const getHexCoords = (score: number, angleIdx: number) => {
    const theta = -Math.PI / 2 + (angleIdx * 2 * Math.PI) / 6;
    const r = maxR * score;
    return {
      x: cx + r * Math.cos(theta),
      y: cy + r * Math.sin(theta),
    };
  };

  const gridRings = [0.25, 0.5, 0.75, 1.0];

  const selectedPolygonPoints = useMemo(() => {
    return RADAR_DIMENSIONS.map((dim, idx) => {
      const score = dim.getScore(selectedInfra);
      const coords = getHexCoords(score, idx);
      return `${coords.x.toFixed(1)},${coords.y.toFixed(1)}`;
    }).join(" ");
  }, [selectedInfra]);

  const sonicPolygonPoints = useMemo(() => {
    return RADAR_DIMENSIONS.map((dim, idx) => {
      const score = dim.getScore(sonicInfra);
      const coords = getHexCoords(score, idx);
      return `${coords.x.toFixed(1)},${coords.y.toFixed(1)}`;
    }).join(" ");
  }, [sonicInfra]);

  const activeNodes = useMemo(() => {
    return RADAR_DIMENSIONS.map((dim, idx) => {
      const score = dim.getScore(selectedInfra);
      const coords = getHexCoords(score, idx);
      return {
        ...coords,
        score,
        dim,
        idx,
        formatted: dim.getFormatted(selectedInfra),
        sonicFormatted: dim.getFormatted(sonicInfra),
      };
    });
  }, [selectedInfra, sonicInfra]);

  const trendPoints = useMemo(() => {
    const leakagePaise = Math.round(totalVolumePaise * (selectedInfra.leakage_basis_points / 10000));
    if (selectedInfra.id === "sonic" && trend.length) {
      return trend.map((t) => ({
        label: `Batch ${t.batch}`,
        rate: t.reconciliation_rate,
        pctText: pct(t.reconciliation_rate),
        leakagePaise,
      }));
    }
    const count = trend.length || 6;
    return Array.from({ length: count }, (_, idx) => ({
      label: `Batch ${idx + 1}`,
      rate: selectedInfra.reconciliation_rate,
      pctText: pct(selectedInfra.reconciliation_rate),
      leakagePaise,
    }));
  }, [selectedInfra, trend, totalVolumePaise]);

  return (
    <div className="rounded-2xl border border-line-soft bg-white/95 backdrop-blur-md shadow-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-azure/10 text-azure">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-navy">
              Reconciliation Architecture Benchmark
            </h3>
            <p className="text-[11px] text-faint">
              Multidimensional comparative analysis across settlement rails
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="inline-flex items-center rounded-xl border border-line/90 bg-slate-100/90 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("radar")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                viewMode === "radar"
                  ? "bg-white text-navy font-bold shadow-xs ring-1 ring-black/5"
                  : "text-slate-500 hover:text-navy"
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-azure" />
              <span>3D Isometric Radar</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("trend")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                viewMode === "trend"
                  ? "bg-white text-navy font-bold shadow-xs ring-1 ring-black/5"
                  : "text-slate-500 hover:text-navy"
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5 text-money-dim" />
              <span>Velocity Trend</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line-soft bg-surface/50 px-5 py-2.5 scrollbar-none">
        <span className="text-[11px] font-semibold text-slate-400 mr-1.5 shrink-0 uppercase tracking-wider font-mono">
          Compare:
        </span>
        {infrastructures.map((infra) => {
          const isSelected = infra.id === selectedId;
          const isSonic = infra.id === "sonic";
          return (
            <button
              key={infra.id}
              onClick={() => onSelectId(infra.id)}
              className={`flex items-center gap-1.5 shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                isSelected
                  ? isSonic
                    ? "bg-azure text-white shadow-xs"
                    : "bg-navy text-white shadow-xs"
                  : "border border-line/80 bg-white text-slate-600 hover:border-azure/40 hover:text-navy shadow-2xs"
              }`}
            >
              {isSonic && <Sparkles className="h-3 w-3 text-amber-300" />}
              <span>{infra.name.split(" ")[0]}</span>
              <span
                className={`rounded px-1 py-0.2 font-mono text-[9px] font-bold ${
                  isSelected
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {pct(infra.reconciliation_rate)}
              </span>
            </button>
          );
        })}

        {selectedId !== "sonic" && viewMode === "radar" && (
          <label className="ml-auto flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={showSonicOverlay}
              onChange={(e) => setShowSonicOverlay(e.target.checked)}
              className="rounded border-slate-300 text-azure focus:ring-azure h-3.5 w-3.5"
            />
            <span>Overlay Sonic</span>
          </label>
        )}
      </div>

      <div className="p-5 sm:p-6 bg-gradient-to-b from-slate-50/40 to-white">
        {viewMode === "radar" ? (

          <div className="grid gap-6 lg:grid-cols-12 items-center">
            <div className="lg:col-span-7 flex flex-col items-center justify-center">
              <div className="relative w-full max-w-[440px] aspect-[460/380] rounded-3xl bg-[#EDF4FC] border border-[#D5E3F5] shadow-inner p-2 sm:p-4 flex items-center justify-center">
                <svg
                  viewBox="0 0 460 380"
                  className="w-full h-full overflow-visible select-none"
                >
                  <defs>
                    <linearGradient
                      id="radarPolygonGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#0C83FD" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.25" />
                    </linearGradient>

                    <linearGradient
                      id="sonicOverlayGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#00A878" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.08" />
                    </linearGradient>

                    <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow
                        dx="0"
                        dy="1"
                        stdDeviation="2"
                        floodColor="#0C83FD"
                        floodOpacity="0.4"
                      />
                    </filter>
                  </defs>

                  {gridRings.map((rPct, rIdx) => {
                    const pts = [0, 1, 2, 3, 4, 5]
                      .map((aIdx) => {
                        const c = getHexCoords(rPct, aIdx);
                        return `${c.x.toFixed(1)},${c.y.toFixed(1)}`;
                      })
                      .join(" ");
                    return (
                      <polygon
                        key={`grid-${rIdx}`}
                        points={pts}
                        fill="none"
                        stroke={rIdx === gridRings.length - 1 ? "#94A3B8" : "#CBD5E1"}
                        strokeWidth={rIdx === gridRings.length - 1 ? 1.4 : 0.8}
                        strokeOpacity={0.7}
                      />
                    );
                  })}

                  {[0, 1, 2, 3, 4, 5].map((aIdx) => {
                    const c = getHexCoords(1.0, aIdx);
                    const isCubeFold = aIdx === 0 || aIdx === 2 || aIdx === 4;
                    return (
                      <line
                        key={`spoke-${aIdx}`}
                        x1={cx}
                        y1={cy}
                        x2={c.x}
                        y2={c.y}
                        stroke="#94A3B8"
                        strokeWidth={isCubeFold ? 1.2 : 0.75}
                        strokeOpacity={0.75}
                      />
                    );
                  })}

                  <circle cx={cx} cy={cy} r={2.5} fill="#64748B" opacity={0.6} />

                  {selectedId !== "sonic" && showSonicOverlay && (
                    <g className="transition-opacity duration-300">
                      <polygon
                        points={sonicPolygonPoints}
                        fill="url(#sonicOverlayGrad)"
                        stroke="#00A878"
                        strokeWidth={1.8}
                        strokeDasharray="4 3"
                        strokeOpacity={0.9}
                      />
                    </g>
                  )}

                  <motion.polygon
                    points={selectedPolygonPoints}
                    fill={selectedId === "sonic" ? "url(#radarPolygonGrad)" : "rgba(12, 131, 253, 0.35)"}
                    stroke={selectedId === "sonic" ? "#0C83FD" : "#0C2340"}
                    strokeWidth={2.4}
                    initial={false}
                    animate={{ points: selectedPolygonPoints }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />

                  {activeNodes.map((node) => {
                    const isHovered = hoveredDimIdx === node.idx;
                    return (
                      <g
                        key={`node-${node.idx}`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredDimIdx(node.idx)}
                        onMouseLeave={() => setHoveredDimIdx(null)}
                      >
                        {isHovered && (
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={11}
                            fill="#0C83FD"
                            opacity={0.25}
                            className="animate-ping"
                          />
                        )}

                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={isHovered ? 7.5 : 6}
                          fill="#FFFFFF"
                          stroke={selectedId === "sonic" ? "#0C83FD" : "#0C2340"}
                          strokeWidth={2.5}
                          filter="url(#nodeGlow)"
                          className="transition-all duration-150"
                        />

                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={2}
                          fill={selectedId === "sonic" ? "#0C83FD" : "#0C2340"}
                        />
                      </g>
                    );
                  })}

                  {activeNodes.map((node) => {
                    const labelOffset = 22;
                    const theta = -Math.PI / 2 + (node.idx * 2 * Math.PI) / 6;
                    const lx = cx + (maxR + labelOffset) * Math.cos(theta);
                    const ly = cy + (maxR + labelOffset) * Math.sin(theta);
                    const isHovered = hoveredDimIdx === node.idx;

                    let anchor: "middle" | "start" | "end" = "middle";
                    if (node.idx === 1 || node.idx === 2) anchor = "start";
                    if (node.idx === 4 || node.idx === 5) anchor = "end";

                    return (
                      <text
                        key={`lbl-${node.idx}`}
                        x={lx}
                        y={ly}
                        textAnchor={anchor}
                        dominantBaseline="central"
                        onMouseEnter={() => setHoveredDimIdx(node.idx)}
                        onMouseLeave={() => setHoveredDimIdx(null)}
                        className={`text-[11px] font-semibold cursor-pointer transition-colors ${
                          isHovered
                            ? "fill-azure font-bold"
                            : "fill-slate-600"
                        }`}
                      >
                        {node.dim.shortName}
                      </text>
                    );
                  })}
                </svg>
              </div>

              <div className="mt-3 flex items-center justify-center gap-5 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-azure border border-white shadow-xs" />
                  <span>{selectedInfra.name.split(" ")[0]} Active Footprint</span>
                </div>
                {selectedId !== "sonic" && showSonicOverlay && (
                  <div className="flex items-center gap-1.5 font-medium text-money-dim">
                    <span className="h-2.5 w-2.5 rounded-full bg-money border border-dashed border-money-dim shadow-xs" />
                    <span>Sonic Benchmark (100% Perimeter)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-3.5">
              <div className="rounded-xl border border-line-soft bg-surface/80 p-4 shadow-xs">
                <div className="flex items-center justify-between gap-2 border-b border-line-soft pb-2.5 mb-2.5">
                  <div>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-azure">
                      Active Dimension Inspector
                    </span>
                    <h4 className="text-sm font-bold text-navy">
                      {hoveredDimIdx !== null
                        ? RADAR_DIMENSIONS[hoveredDimIdx].name
                        : "6-Axis Evaluation Model"}
                    </h4>
                  </div>
                  {hoveredDimIdx !== null ? (
                    <span className="rounded-md bg-azure-light px-2 py-0.5 font-mono text-xs font-bold text-azure border border-azure/20">
                      {activeNodes[hoveredDimIdx].formatted}
                    </span>
                  ) : (
                    <span className="rounded-md bg-money-light px-2 py-0.5 font-mono text-xs font-bold text-money-dim border border-money/20">
                      {pct(selectedInfra.reconciliation_rate)} Overall
                    </span>
                  )}
                </div>

                <p className="text-xs text-dim leading-relaxed">
                  {hoveredDimIdx !== null
                    ? RADAR_DIMENSIONS[hoveredDimIdx].description
                    : "Six-axis comparison of settlement reconciliation architecture."}
                </p>

                <div className="grid grid-cols-2 gap-2 mt-3.5">
                  {activeNodes.map((node) => {
                    const isHovered = hoveredDimIdx === node.idx;
                    return (
                      <div
                        key={node.dim.key}
                        onMouseEnter={() => setHoveredDimIdx(node.idx)}
                        onMouseLeave={() => setHoveredDimIdx(null)}
                        className={`rounded-lg p-2.5 border transition-all cursor-pointer ${
                          isHovered
                            ? "border-azure bg-azure-light/40 shadow-xs"
                            : "border-line-soft bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-slate-400">
                          <span>{node.dim.shortName}</span>
                          <span className="font-mono text-navy font-bold">
                            {node.formatted}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              selectedId === "sonic" ? "bg-azure" : "bg-slate-600"
                            }`}
                            style={{ width: `${Math.round(node.score * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-line-soft bg-slate-50/70 p-3.5 text-xs text-dim space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-navy">
                    {selectedInfra.name}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-azure">
                    {selectedInfra.latency_label}
                  </span>
                </div>
                <p className="text-[11.5px] text-faint leading-normal">
                  {selectedInfra.strengths}
                </p>
                {selectedId !== "sonic" && (
                  <div className="mt-2 rounded-lg bg-amber/10 border border-amber/20 p-2 text-[11px] text-amber-900 leading-tight">
                    <strong className="font-semibold text-amber-950">Vulnerability: </strong>
                    {selectedInfra.vulnerability}
                  </div>
                )}
                <div className="mt-2 flex items-start justify-between gap-2 border-t border-line-soft pt-2">
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${
                      selectedInfra.basis === "measured"
                        ? "border-money/30 bg-money-light text-money-dim"
                        : selectedInfra.basis === "cited"
                        ? "border-azure/30 bg-azure-light text-azure"
                        : "border-amber/30 bg-amber/10 text-amber-700"
                    }`}
                  >
                    {selectedInfra.basis === "measured"
                      ? "Measured"
                      : selectedInfra.basis === "cited"
                      ? "Cited"
                      : "Industry est."}
                  </span>
                  <p className="text-[10px] text-faint leading-tight">
                    {selectedInfra.source_note}{" "}
                    {selectedInfra.source_url && (
                      <a
                        href={selectedInfra.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-azure hover:underline whitespace-nowrap"
                      >
                        Source ↗
                      </a>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-navy mr-1">Trend Metric:</span>
                <button
                  type="button"
                  onClick={() => setTrendMetric("rate")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    trendMetric === "rate"
                      ? "bg-azure text-white shadow-xs"
                      : "border border-line bg-white text-dim hover:bg-raised"
                  }`}
                >
                  Auto-Match Rate (%)
                </button>
                <button
                  type="button"
                  onClick={() => setTrendMetric("leakage")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    trendMetric === "leakage"
                      ? "bg-azure text-white shadow-xs"
                      : "border border-line bg-white text-dim hover:bg-raised"
                  }`}
                >
                  Revenue Leakage (₹)
                </button>
              </div>

              <span
                className={`rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-semibold ${
                  selectedInfra.id === "sonic"
                    ? "border-money/30 bg-money-light text-money-dim"
                    : "border-line-soft bg-white text-slate-500"
                }`}
              >
                {selectedInfra.id === "sonic"
                  ? `Measured · ${trendPoints.length} real sub-batches`
                  : "Steady-state (no public time series)"}
              </span>
            </div>

            <div className="relative w-full aspect-[21/9] min-h-[220px] rounded-2xl bg-gradient-to-b from-[#F0F5FD] to-[#F8FAFD] border border-[#D8E6F8] p-4 sm:p-6 flex flex-col justify-between">
              <svg viewBox="0 0 600 200" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="areaTrendGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#0C83FD" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#0C83FD" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {[30, 75, 120, 165].map((yVal, gIdx) => (
                  <line
                    key={`hline-${gIdx}`}
                    x1={30}
                    y1={yVal}
                    x2={570}
                    y2={yVal}
                    stroke="#CBD5E1"
                    strokeWidth={0.8}
                    strokeOpacity={0.6}
                  />
                ))}

                {(() => {
                  const xStep = 540 / (trendPoints.length - 1);
                  const minVal = trendMetric === "rate" ? 0.6 : 0;
                  const maxVal = trendMetric === "rate" ? 1.0 : totalVolumePaise * 0.03;

                  const points = trendPoints.map((pt, idx) => {
                    const val = trendMetric === "rate" ? pt.rate : pt.leakagePaise;
                    const norm = Math.min(1, Math.max(0, (val - minVal) / (maxVal - minVal)));
                    const x = 30 + idx * xStep;
                    const y = 165 - norm * 135;
                    return { x, y, pt };
                  });

                  const pathD = points.reduce((acc, p, i) => {
                    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
                  }, "");
                  const areaD = `${pathD} L ${points[points.length - 1].x} 165 L ${points[0].x} 165 Z`;

                  return (
                    <>
                      <path d={areaD} fill="url(#areaTrendGrad)" />

                      <path
                        d={pathD}
                        fill="none"
                        stroke="#0C83FD"
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {points.map((p, idx) => (
                        <g key={`pt-${idx}`} className="group cursor-pointer">
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={5.5}
                            fill="#FFFFFF"
                            stroke="#0C83FD"
                            strokeWidth={2.2}
                            className="transition-transform group-hover:scale-125"
                          />
                          <circle cx={p.x} cy={p.y} r={2} fill="#0C83FD" />

                          <title>
                            {`${p.pt.label}: ${
                              trendMetric === "rate"
                                ? p.pt.pctText
                                : rupees(p.pt.leakagePaise)
                            }`}
                          </title>
                        </g>
                      ))}
                    </>
                  );
                })()}

                {trendPoints.map((pt, idx) => {
                  const xStep = 540 / (trendPoints.length - 1);
                  const x = 30 + idx * xStep;
                  return (
                    <text
                      key={`lbl-${idx}`}
                      x={x}
                      y={188}
                      textAnchor="middle"
                      className="fill-slate-500 font-mono text-[10px] font-semibold"
                    >
                      {pt.label}
                    </text>
                  );
                })}
              </svg>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 border-t border-line-soft pt-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-navy">{selectedInfra.name}:</span>
                <span>
                  {trendMetric === "rate"
                    ? `Steady ${pct(selectedInfra.reconciliation_rate)} auto-reconciliation across evaluated batches.`
                    : `Estimated leakage drag: ${rupees(
                        Math.round(
                          totalVolumePaise * (selectedInfra.leakage_basis_points / 10000)
                        )
                      )} (${selectedInfra.leakage_basis_points} bps).`}
                </span>
              </div>
              <span className="font-mono text-[11px] text-money-dim font-bold">
                ✓ Continuous Deterministic Verification
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
