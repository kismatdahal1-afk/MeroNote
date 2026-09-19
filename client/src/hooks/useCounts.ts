import { useApiQuery } from "./useApiQuery";
import { fetchCount } from "../lib/contentApi";

/**
 * Lightweight card counts via `limit=1` totals (exact, tiny responses).
 * Keeps cards self-contained so list pages need no N+1 plumbing of their own.
 * Returns null while loading or on error — callers fall back gracefully.
 */
export function useCounts(params: { semesterId?: string; subjectId?: string }): {
  subjects: number | null;
  resources: number | null;
} {
  const key = `counts:${params.semesterId ?? ""}:${params.subjectId ?? ""}`;
  const { data } = useApiQuery<{
    subjects: number | null;
    resources: number | null;
  }>(key, async (signal) => {
    const [subjects, resources] = await Promise.all([
      params.semesterId
        ? fetchCount("/api/subjects", { semesterId: params.semesterId }, signal)
        : Promise.resolve(null),
      fetchCount(
        "/api/resources",
        params.subjectId
          ? { subjectId: params.subjectId }
          : params.semesterId
            ? { semesterId: params.semesterId }
            : {},
        signal,
      ),
    ]);
    return { subjects, resources };
  });
  return { subjects: data?.subjects ?? null, resources: data?.resources ?? null };
}
