import { useEffect, useRef, useState } from "react";
import type { PolicyMetrics } from "./types";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ---- formatting -------------------------------------------------------------
// Paise are integers on the wire; the API also ships *_rupees convenience fields.
export const rupees = (paise: number, opts: { decimals?: number } = {}): string =>
  (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: opts.decimals ?? 0,
    minimumFractionDigits: opts.decimals ?? 0,
  });

export const pct = (x: number, d = 1): string => `${(x * 100).toFixed(d)}%`;
export const signed = (x: number, d = 1): string => `${x >= 0 ? "+" : ""}${x.toFixed(d)}%`;

// Count a value up on change — the hero's single authored moment. Falls straight
// to the target under reduced-motion, and always lands exactly on `target`.
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
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(a + (target - a) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

// ---- scroll reveal ----------------------------------------------------------
// Adds `reveal-in` when the element first scrolls into view (IntersectionObserver).
// Reduced-motion is handled in CSS (the .reveal transition is neutralized there).
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

// ---- streamed batch playback (SSE) ------------------------------------------
export interface StreamCum {
  gross: number;
  recovered: number;
  attempts: number;
}
export interface BatchStreamView {
  oracle: number;
  baseline: StreamCum;
  smart: StreamCum;
  phase: "streaming" | "done";
  final: PolicyMetrics[] | null;
  progress: number; // 0..1
}

const ZERO: StreamCum = { gross: 0, recovered: 0, attempts: 0 };

// Replay a deterministic batch as it scores. Returns null until the first frame
// arrives (caller falls back to a static /batch fetch if SSE never produces).
// Re-runs whenever (seed, n, runId) change — runId lets "Run" replay in place.
export function useBatchStream(seed: number, n: number, runId = 0): BatchStreamView | null {
  const [view, setView] = useState<BatchStreamView | null>(null);
  useEffect(() => {
    setView(null);
    const secs = prefersReducedMotion() ? 0 : 1.6;
    const es = new EventSource(`/batch/stream?seed=${seed}&n=${n}&secs=${secs}`);
    let oracle = 0;

    es.addEventListener("meta", (e) => {
      oracle = JSON.parse((e as MessageEvent).data).oracle_paise;
      setView({ oracle, baseline: ZERO, smart: ZERO, phase: "streaming", final: null, progress: 0 });
    });
    es.addEventListener("progress", (e) => {
      const p = JSON.parse((e as MessageEvent).data);
      setView({
        oracle, baseline: p.baseline, smart: p.smart,
        phase: "streaming", final: null, progress: p.i / p.total,
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
        phase: "done", final: d.policies, progress: 1,
      });
      es.close();
    });
    es.onerror = () => es.close(); // leave view as-is; caller falls back if still null

    return () => es.close();
  }, [seed, n, runId]);
  return view;
}

// ---- data fetching ----------------------------------------------------------
export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

// Deterministic endpoints: (seed, n) fully determines the response, so a plain
// fetch keyed on the query string is all we need. `deps` re-fetches on change.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
