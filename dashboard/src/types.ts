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
