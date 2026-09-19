import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../lib/contentApi";

/**
 * Minimal async query hook: loading/error/data + stale-response protection.
 * One-shot fetches run on mount/key change; callers trigger refetch by
 * changing `key`. Aborts in-flight requests on unmount or key change.
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
        setError(err instanceof ApiError ? err.message : "Something went wrong.");
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [key, nonce]);

  const retry = useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  return { data, error, loading, retry };
}
