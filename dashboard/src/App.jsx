import { useEffect, useState } from "react";

// Dashboard scaffold (ARCHITECTURE.md §04). Panels land in Week 3:
// ₹ recovered · net value · exceptions · regret vs oracle · calibration · audit trail.
export default function App() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch("/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: "api offline" }));
  }, []);

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 p-8">
      <h1 className="text-2xl font-semibold">Tijori — Recovery Dashboard</h1>
      <p className="text-neutral-500 mt-1">
        Detect → act → audit → reconcile. Track 3 · Revenue Recovery.
      </p>
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
        <p className="text-sm text-neutral-500">API</p>
        <p className="font-mono">{health ? JSON.stringify(health) : "…"}</p>
      </div>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {["₹ recovered (smart vs baseline)", "Net value (F3)", "Exceptions (fee/timing/missing)", "Regret vs oracle (F2)", "Calibration drift (F1)", "Audit trail"].map(
          (panel) => (
            <li key={panel} className="rounded-xl border border-dashed border-neutral-300 p-4 text-neutral-400">
              {panel} — Week 3
            </li>
          )
        )}
      </ul>
    </main>
  );
}
