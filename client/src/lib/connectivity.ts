import { useSyncExternalStore } from "react";

/**
 * Browser connectivity (Phase 9) — advisory only. `navigator.onLine` plus
 * online/offline events; network requests remain authoritative (online does
 * NOT guarantee the API is reachable).
 */

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function snapshot(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => true);
}

/** True for failures that mean "no usable network" (vs. app-level errors). */
export function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|load failed|network request failed/i.test(message);
}
