import { useEffect, useRef, useState } from "react";
import type { PolicyMetrics } from "./types";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const springClean = {
  type: "spring" as const,
  stiffness: 280,
  damping: 28,
};

export const easeFintech = [0.16, 1, 0.3, 1] as const;

export const fadeInUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.36, ease: easeFintech },
};

export const staggerContainer = (stagger = 0.06) => ({
  initial: {},
  animate: {
    transition: {
      staggerChildren: stagger,
    },
  },
});

export const rupees = (paise: number, opts: { decimals?: number } = {}): string =>
  (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: opts.decimals ?? 0,
    minimumFractionDigits: opts.decimals ?? 0,
  });

export const pct = (x: number, d = 1): string => `${(x * 100).toFixed(d)}%`;
export const signed = (x: number, d = 1): string => `${x >= 0 ? "+" : ""}${x.toFixed(d)}%`;

export function useCountUp(target: number, ms = 700): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(a + (target - a) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function useReveal<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (!("IntersectionObserver" in window)) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return { ref, shown };
}

export interface StreamCum {
  gross: number;
  recovered: number;
  attempts: number;
}
export interface StreamFlows {
  cause_mid: Record<string, number>;
  mid_out: Record<string, number>;
}
export interface BatchStreamView {
  oracle: number;
  baseline: StreamCum;
  smart: StreamCum;
  phase: "streaming" | "done";
  final: PolicyMetrics[] | null;
  progress: number;
  flows: StreamFlows | null;
}

const ZERO: StreamCum = { gross: 0, recovered: 0, attempts: 0 };

export function useBatchStream(seed: number, n: number, runId = 0): BatchStreamView | null {
  const [view, setView] = useState<BatchStreamView | null>(null);
  useEffect(() => {
    setView(null);
    const secs = prefersReducedMotion() ? 0 : 1.6;
    const es = new EventSource(`/batch/stream?seed=${seed}&n=${n}&secs=${secs}`);
    let oracle = 0;

    es.addEventListener("meta", (e) => {
      oracle = JSON.parse((e as MessageEvent).data).oracle_paise;
      setView({ oracle, baseline: ZERO, smart: ZERO, phase: "streaming", final: null, progress: 0, flows: null });
    });
    es.addEventListener("progress", (e) => {
      const p = JSON.parse((e as MessageEvent).data);
      setView({
        oracle, baseline: p.baseline, smart: p.smart,
        phase: "streaming", final: null, progress: p.i / p.total, flows: p.flows ?? null,
      });
    });
    es.addEventListener("done", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      const pick = (name: string) => d.policies.find((x: PolicyMetrics) => x.policy === name);
      const bl = pick("baseline"), sm = pick("smart");
      setView({
        oracle: d.oracle_paise,
        baseline: { gross: bl.gross_recovered_paise, recovered: bl.n_recovered, attempts: bl.n_attempts },
        smart: { gross: sm.gross_recovered_paise, recovered: sm.n_recovered, attempts: sm.n_attempts },
        phase: "done", final: d.policies, progress: 1, flows: d.flows ?? null,
      });
      es.close();
    });
    es.onerror = () => es.close();

    return () => es.close();
  }, [seed, n, runId]);
  return view;
}

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function useApi<T>(path: string, deps: unknown[] = []): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fetch(path)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json() as Promise<T>;
      })
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error: unknown) =>
        alive && setState({ data: null, error: String(error), loading: false }),
      );
    return () => {
      alive = false;
    };

  }, deps);
  return state;
}
