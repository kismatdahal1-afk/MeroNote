import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { ResourceCard } from "../components/cards/ResourceCard";
import { EmptyState, ErrorState } from "../components/common/States";
import { Select } from "../components/common/Field";
import { SearchBar } from "../components/common/SearchBar";
import { FilterChips } from "../components/resources/FilterChips";
import { fetchResources, fetchSemesters, fetchSubjects } from "../lib/contentApi";
import { ALL_RESOURCE_TYPES } from "../lib/resourceType";
import { useApiQuery } from "../hooks/useApiQuery";
import { ResourcesSkeleton } from "../components/skeletons/pages";
import type { ResourceType } from "../types";

type SortKey = "recent" | "title" | "pages";

export default function Resources() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [subjectId, setSubjectId] = useState("");
  // Deep-linkable initial filter for footer links (e.g. ?type=book).
  // Synced only when the param is present, so in-page chip/semester
  // selection is never clobbered.
  const [type, setType] = useState<ResourceType | "all">(() => queryTypeParam(params));
  const [sort, setSort] = useState<SortKey>("recent");

  const typeParam = params.get("type") ?? "";
  useEffect(() => {
    if (!typeParam) return;
    if ((ALL_RESOURCE_TYPES as string[]).includes(typeParam)) {
      setType(typeParam as ResourceType);
    }
  }, [typeParam]);

  const semesterId = querySemesterParam(params);

  const { data: taxonomy, error: taxonomyError } = useApiQuery("resources-taxonomy", async (signal) => {
    const semesters = await fetchSemesters(signal);
    const perSemester = await Promise.all(
      semesters.rows.map((semester) => fetchSubjects(semester.id, signal)),
    );
    return {
      semesters: semesters.rows,
      subjects: perSemester.flatMap((list) => list.rows),
    };
  });
  const semesters = useMemo(() => taxonomy?.semesters ?? [], [taxonomy]);
  const allSubjects = useMemo(() => taxonomy?.subjects ?? [], [taxonomy]);

  const subjectOptions = useMemo(
    () =>
      semesterId
        ? allSubjects.filter((s) => s.semesterId === semesterId)
        : allSubjects,
    [allSubjects, semesterId],
  );

  const filterKey = `resources:${semesterId}:${subjectId}:${type}`;
  const { data, error, loading, retry } = useApiQuery(filterKey, (signal) =>
    fetchResources(
      {
        ...(semesterId ? { semesterId } : {}),
        ...(subjectId ? { subjectId } : {}),
        ...(type !== "all" ? { type } : {}),
        limit: 100,
      },
      signal,
    ),
  );
  const pool = useMemo(() => data?.rows ?? [], [data]);

  const filtered = useMemo(() => {
    const sorted = [...pool];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "pages") sorted.sort((a, b) => b.pageCount - a.pageCount);
    if (sort === "recent")
      sorted.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
    return sorted;
  }, [pool, sort]);

  const counts = useMemo(() => {
    const map: Partial<Record<ResourceType, number>> = {};
    for (const r of pool) map[r.type] = (map[r.type] ?? 0) + 1;
    return map;
  }, [pool]);

  return (
    <div>
      <PageHeader
        title="Resources"
        subtitle="Browse study resources — books, notes, past papers, and more."
      />

      <SearchBar
        initialValue=""
        className="mb-5 max-w-xl"
        placeholder="Search notes, subjects, past questions…"
        onSubmit={(q) => {
          const trimmed = q.trim();
          navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/resources");
        }}
      />

      {taxonomyError && !taxonomy && (
        <div className="mb-5">
          <ErrorState message={taxonomyError} onRetry={() => window.location.reload()} />
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:flex sm:flex-nowrap">
        <Select
          id="resources-semester"
          label=""
          value={semesterId}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value) next.set("sem", e.target.value);
            else next.delete("sem");
            setParams(next, { replace: true });
            setSubjectId("");
          }}
          className="w-full sm:w-48"
          aria-label="Filter by semester"
          options={[
            { value: "", label: "All semesters" },
            ...semesters.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
        <Select
          id="resources-sort"
          label=""
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="w-full sm:w-48 sm:order-last"
          aria-label="Sort resources"
          options={[
            { value: "recent", label: "Sort by newest" },
            { value: "title", label: "Sort by title" },
            { value: "pages", label: "Sort by page count" },
          ]}
        />
        <Select
          id="resources-subject"
          label=""
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="col-span-2 w-full sm:col-span-1 sm:w-56"
          aria-label="Filter by subject"
          options={[
            { value: "", label: "All subjects" },
            ...subjectOptions.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      </div>

      <div className="mb-5">
        <FilterChips selected={type} counts={counts} onChange={setType} />
      </div>

      {loading ? (
        <ResourcesSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No resources"
          message="No resources match the current filters."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map((r) => (
            <ResourceCard key={r.id} resource={r} via="resources" />
          ))}
        </div>
      )}
    </div>
  );
}

function querySemesterParam(params: URLSearchParams): string {
  return params.get("sem") ?? "";
}

function queryTypeParam(params: URLSearchParams): ResourceType | "all" {
  const t = params.get("type");
  return t && (ALL_RESOURCE_TYPES as string[]).includes(t)
    ? (t as ResourceType)
    : "all";
}
