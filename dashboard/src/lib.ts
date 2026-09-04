import { useEffect, useRef, useState } from "react";

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
