import { useMemo } from "react";
import { useApiQuery } from "./useApiQuery";
import { fetchSemesters, fetchSubjects } from "../lib/contentApi";

/**
 * Session-wide academic taxonomy (semester/subject names for card context
 * lines). Fetched once per session via a shared promise — every card that
 * mounts reuses it instead of issuing its own requests. Names resolve to
 * undefined until loaded; cards degrade gracefully (context line hidden).
 */

interface Taxonomy {
  semesters: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string; semesterId: string }>;
}

let taxonomyPromise: Promise<Taxonomy> | null = null;

function loadTaxonomy(signal: AbortSignal): Promise<Taxonomy> {
  if (!taxonomyPromise) {
    taxonomyPromise = (async () => {
      const semesters = await fetchSemesters(signal);
      const perSemester = await Promise.all(
        semesters.rows.map((semester) => fetchSubjects(semester.id, signal).catch(() => ({ rows: [], total: 0 }))),
      );
      return {
        semesters: semesters.rows.map((s) => ({ id: s.id, name: s.name })),
        subjects: perSemester.flatMap((list) =>
          list.rows.map((s) => ({ id: s.id, name: s.name, semesterId: s.semesterId })),
        ),
      };
    })().catch((err) => {
      taxonomyPromise = null;
      throw err;
    });
  }
  return taxonomyPromise;
}

export function useTaxonomy(): {
  semesters: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string; semesterId: string }>;
  subjectName: (id: string | undefined) => string | undefined;
  semesterName: (id: string | undefined) => string | undefined;
} {
  const { data } = useApiQuery("taxonomy", (signal) => loadTaxonomy(signal));
  return useMemo(() => {
    const subjects = new Map((data?.subjects ?? []).map((s) => [s.id, s.name] as const));
    const semesters = new Map((data?.semesters ?? []).map((s) => [s.id, s.name] as const));
    return {
      semesters: data?.semesters ?? [],
      subjects: (data?.subjects ?? []).map((s) => ({ id: s.id, name: s.name, semesterId: s.semesterId })),
      subjectName: (id) => (id ? subjects.get(id) : undefined),
      semesterName: (id) => (id ? semesters.get(id) : undefined),
    };
  }, [data]);
}
