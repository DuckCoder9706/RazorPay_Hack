// Typed shapes for every read-only endpoint the dashboard consumes. Kept in one
// place so panels and hooks share one contract with tijori/api/app.py.

export interface HealthResponse {
  status: string;
  version: string;
}

export type PolicyName = "baseline" | "smart";

export interface PolicyMetrics {
  policy: PolicyName;
  n_failures: number;
  n_attempts: number;
  n_recovered: number;
  gross_recovered_paise: number;
  net_value_paise: number;
  recovery_rate: number;
  efficiency: number;
  regret_paise: number;
  gross_recovered_rupees: number;
  net_value_rupees: number;
}

export interface BatchResponse {
  seed: number;
  n: number;
  oracle_paise: number;
  oracle_rupees: number;
  at_risk_paise: number;
  at_risk_rupees: number;
  policies: PolicyMetrics[];
  delta: {
    gross_paise: number;
    gross_rupees: number;
    gross_pct: number;
    net_paise: number;
    net_rupees: number;
  };
}

export interface LearnPoint {
  batch: number;
  seed: number;
  issuer_timing: string;
  efficiency: number;
  regret_paise: number;
  gross_paise: number;
  mean_brier: number;
}

export interface LearnResponse {
  seed: number;
  n: number;
  batches: number;
  n_min: number;
  ema_alpha: number;
  on: LearnPoint[];
  off: LearnPoint[];
}

export type ExceptionType = "fee" | "timing" | "missing";

export interface ExceptionRow {
  id: string;
  type: ExceptionType;
  expected: number;
  observed: number;
  delta: number;
  status: string;
  settlement_id: string | null;
  bank_row_id: string | null;
}

export interface ExceptionsResponse {
  seed: number;
  n: number;
  summary: {
    detected: Partial<Record<ExceptionType, number>>;
    total_exceptions: number;
    reconciled: number;
    netting_reconciled: number;
  };
  exceptions: ExceptionRow[];
}

export interface ChurnRow {
  c_churn_paise: number;
  baseline_net: number;
  smart_net: number;
  baseline_gross: number;
  smart_gross: number;
  smart_attempts: number;
  smart_wins_net: boolean;
  smart_wins_gross: boolean;
}

export interface ChurnResponse {
  seed: number;
  n: number;
  rows: ChurnRow[];
  smart_always_wins_net: boolean;
}

export interface CauseRow {
  cause: string;
  weight: number;
  retryable: boolean;
  world: Record<string, number>;
  belief: Record<string, number>;
  world_best_timing: string;
  belief_best_timing: string;
  belief_wrong: boolean;
}

export interface OutcomeModelResponse {
  timings: string[];
  causes: CauseRow[];
  baseline_schedule: number[];
  max_attempts: number;
  c_retry_paise: number;
  c_churn_paise: number;
}

export interface AuditEvent {
  id: number;
  ts: string;
  actor: string;
  event: string;
  seed: number;
  payload: Record<string, unknown>;
}

export interface AuditResponse {
  seed: number;
  n: number;
  total: number;
  events: AuditEvent[];
}

export interface VerifyResponse {
  seed: number;
  n: number;
  hash_a: string;
  hash_b: string;
  identical: boolean;
  algo: string;
  decisions: number;
  micros_per_decision: number;
  decisions_per_sec: number;
}

export interface RazorpayLink {
  ok: boolean;
  live?: boolean;
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  short_url?: string;
  description?: string;
  created_at?: number;
  reason?: string;
  detail?: string;
}

export interface CustomerCohortInfo {
  tier: string;
  count: number;
  pct: number;
  desc: string;
}

export interface InjectedFailure {
  id: string;
  order_id: string;
  amount_paise: number;
  reason_code: string;
  cause: string;
  customer_value: "high" | "mid" | "low";
  created_at: string;
}

export interface InjectedSubstrateRow {
  settlement_id: string;
  batch_id: string;
  gross_paise: number;
  fee_paise: number;
  net_paise: number;
  settled_at: string;
  bank_row_id: string | null;
  bank_credit_paise: number | null;
  bank_value_date: string | null;
  status: "matched" | "discrepancy" | "missing";
}

export interface InjectedAnomaly {
  type: "fee" | "timing" | "missing" | "netting";
  settlement_id: string;
  expected_paise?: number;
  observed_paise?: number;
  delta_paise?: number;
  expected_date?: string;
  observed_date?: string | null;
  details: string;
}

export interface PipelineResponse {
  seed: number;
  n: number;
  fingerprint: string;
  summary: {
    seed: number;
    n_onetime_failures: number;
    n_mandate_failures: number;
    n_settlements: number;
    n_bank_rows: number;
    total_at_risk_paise: number;
    cause_mix: Record<string, number>;
    injected_exceptions: {
      fee: number;
      timing: number;
      missing: number;
      netting: number;
    };
  };
  customer_cohorts: {
    high: CustomerCohortInfo;
    mid: CustomerCohortInfo;
    low: CustomerCohortInfo;
  };
  sample_failures: InjectedFailure[];
  sample_substrate: InjectedSubstrateRow[];
  injected_details: InjectedAnomaly[];
}

export interface ReconInfrastructure {
  id: string;
  name: string;
  category: "active" | "baseline" | "competitor" | "legacy";
  reconciliation_rate: number;
  latency_label: string;
  latency_hours: number;
  leakage_basis_points: number; // bps of total volume
  manual_touch_pct: number;
  first_pass_match_rate?: number; // Tijori only: clean match before exception diagnosis
  basis: "measured" | "cited" | "industry_estimate";
  source_url: string;
  source_note: string;
  strengths: string;
  vulnerability: string;
  features: string[];
}

export interface ReconTrendPoint {
  batch: number;
  seed: number;
  reconciliation_rate: number;
  first_pass_match_rate: number;
  total_exceptions: number;
  reconciled: number;
  netting_reconciled: number;
}

export interface ReconBenchmarkResponse {
  seed: number;
  n: number;
  total_volume_paise: number;
  summary: {
    detected: Partial<Record<string, number>>;
    total_exceptions: number;
    reconciled: number;
    netting_reconciled: number;
  };
  trend: ReconTrendPoint[];
  trend_note: string;
  infrastructures: ReconInfrastructure[];
}

