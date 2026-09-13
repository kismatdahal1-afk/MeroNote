import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { ResourceCard } from "../components/cards/ResourceCard";
import { EmptyState } from "../components/common/States";
import { Select } from "../components/common/Field";
import { SearchBar } from "../components/common/SearchBar";
import { FilterChips } from "../components/resources/FilterChips";
import {
  getAllSemesters,
  getAllResources,
  searchResources,
  getAllSubjects,
} from "../data/selectors";
import type { ResourceType } from "../types";
import { useCmsSync } from "../components/common/CmsSync";

type SortKey = "recent" | "title" | "pages";

export default function Resources() {
  useCmsSync();
  const semesters = getAllSemesters();
  const all = getAllResources();
  const allSubjects = getAllSubjects();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";

  const [subjectId, setSubjectId] = useState("");
  const [type, setType] = useState<ResourceType | "all">("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const updateQuery = (q: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (q) next.set("q", q);
      else next.delete("q");
      return next;
    }, { replace: true });
  };

  const subjectOptions = useMemo(
    () =>
      querySemesterParam(params)
        ? allSubjects.filter((s) => s.semesterId === querySemesterParam(params))
        : allSubjects,
    [params],
  );

  const semesterId = querySemesterParam(params);

  const searchPool = useMemo(
    () => (query ? searchResources(query) : all),
    [query, all],
  );

  const filtered = useMemo(() => {
    let list = searchPool;
    if (semesterId) list = list.filter((r) => r.semesterId === semesterId);
    if (subjectId) list = list.filter((r) => r.subjectId === subjectId);
    if (type !== "all") list = list.filter((r) => r.type === type);
    const sorted = [...list];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "pages") sorted.sort((a, b) => b.pageCount - a.pageCount);
    if (sort === "recent")
      sorted.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
    return sorted;
  }, [searchPool, semesterId, subjectId, type, sort]);

  const counts = useMemo(() => {
    let base = searchPool;
    if (semesterId) base = base.filter((r) => r.semesterId === semesterId);
    if (subjectId) base = base.filter((r) => r.subjectId === subjectId);
    const map: Partial<Record<ResourceType, number>> = {};
    for (const r of base) map[r.type] = (map[r.type] ?? 0) + 1;
    return map;
  }, [searchPool, semesterId, subjectId]);

  return (
    <div>
      <PageHeader
        title="Resources"
        subtitle={`Browse all ${all.length} study resources — books, notes, past papers, and more.`}
      />

      <SearchBar
        initialValue={query}
        className="mb-5 max-w-xl"
        placeholder="Search notes, past questions, algorithms..."
        onSubmit={updateQuery}
        onChange={updateQuery}
      />

      {query && (
        <p className="mb-4 text-sm text-muted-foreground">
          {filtered.length} result{filtered.length === 1 ? "" : "s"} for{" "}
          <span className="font-semibold text-foreground">&ldquo;{query}&rdquo;</span>
        </p>
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

      {filtered.length === 0 ? (
        query ? (
          <EmptyState
            title="No results found"
            message={`Nothing matched "${query}". Try a different term or check the spelling.`}
          />
        ) : (
          <EmptyState
            title="No resources"
            message="No resources match the current filters."
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function querySemesterParam(params: URLSearchParams): string {
  return params.get("sem") ?? "";
}
