import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

type HealthState = "loading" | "ok" | "down";

export default function App() {
  const [health, setHealth] = useState<HealthState>("loading");

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/api/health`)
      .then((res): HealthState => (res.ok ? "ok" : "down"))
      .catch((): HealthState => "down")
      .then((state) => {
        if (!cancelled) setHealth(state);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Mero Note
        </h1>
        <p className="mt-2 text-slate-400">Foundation setup (Phase 1)</p>
        <p
          className={`mt-6 inline-block rounded-full px-4 py-1 text-sm ${
            health === "ok"
              ? "bg-emerald-500/15 text-emerald-400"
              : health === "down"
                ? "bg-red-500/15 text-red-400"
                : "bg-slate-500/15 text-slate-400"
          }`}
        >
          API:{" "}
          {health === "ok"
            ? "connected"
            : health === "down"
              ? "not reachable"
              : "checking..."}
        </p>
      </div>
    </main>
  );
}
