import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../lib/contentApi";
import { isUnauthorizedStatus } from "../lib/authGate";
import { refreshSession } from "../lib/authRefresh";
import { useUser } from "../state/UserProvider";

/**
 * Minimal async query hook: loading/error/data + stale-response protection.
 * One-shot fetches run on mount/key change; callers trigger refetch by
 * changing `key`. Aborts in-flight requests on unmount or key change.
 *
 * F2/F4: a 401 from the latest request first attempts ONE shared session
 * refresh and retries the fetch a single time. Only when the refresh fails
 * (or the retry 401s again) is the authenticated state invalidated
 * (RequireAuth then redirects). The retry never refreshes again — no loops.
 * Every other status keeps existing local error handling — only 401 drives
 * this path, never 403/404/409/422/429/5xx.
 */

export interface ApiQueryState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
}

export function useApiQuery<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>): ApiQueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const { invalidateSession } = useUser();

  useEffect(() => {
    const id = ++requestId.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (requestId.current !== id) return;
        setData(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (requestId.current !== id) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof ApiError && isUnauthorizedStatus(err.status)) {
          // Expired access: refresh once (shared single-flight), then retry
          // this fetch exactly once. Refresh failure or a second 401 means
          // the session is truly dead → invalidate.
          void (async () => {
            try {
              await refreshSession();
            } catch {
              if (requestId.current !== id) return;
              invalidateSession();
              setError(err.message);
              setLoading(false);
              return;
            }
            if (requestId.current !== id) return;
            try {
              const result = await fetcherRef.current(controller.signal);
              if (requestId.current !== id) return;
              setData(result);
              setLoading(false);
            } catch (retryErr: unknown) {
              if (requestId.current !== id) return;
              if (retryErr instanceof DOMException && retryErr.name === "AbortError") return;
              if (retryErr instanceof ApiError && isUnauthorizedStatus(retryErr.status)) invalidateSession();
              setError(retryErr instanceof ApiError ? retryErr.message : "Something went wrong.");
              setLoading(false);
            }
          })();
          return;
        }
        setError(err instanceof ApiError ? err.message : "Something went wrong.");
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [key, nonce, invalidateSession]);

  const retry = useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  return { data, error, loading, retry };
}
