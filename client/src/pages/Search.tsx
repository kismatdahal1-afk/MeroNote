import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { SearchBar } from "../components/common/SearchBar";
import { ResourceCard } from "../components/cards/ResourceCard";
import { EmptyState } from "../components/common/States";
import { FilterChips } from "../components/resources/FilterChips";
import { searchResources } from "../data/selectors";
import type { ResourceType } from "../types";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const [typeFilter, setTypeFilter] = useState<ResourceType | "all">("all");

  const results = useMemo(() => searchResources(query), [query]);
  const counts = useMemo(() => {
    const map: Partial<Record<ResourceType, number>> = {};
    for (const r of results) map[r.type] = (map[r.type] ?? 0) + 1;
    return map;
  }, [results]);

  const filtered = useMemo(
    () => (typeFilter === "all" ? results : results.filter((r) => r.type === typeFilter)),
    [results, typeFilter],
  );

  const updateQuery = (q: string) => {
    setParams(q ? { q } : {}, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Search"
        subtitle="Find resources by title, subject, semester, type, or tag."
      />
      <SearchBar
        initialValue={query}
        className="mb-4 max-w-xl"
        placeholder="Search resources..."
        onSubmit={updateQuery}
      />

      {query && (
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          {results.length} result{results.length === 1 ? "" : "s"} for{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">&ldquo;{query}&rdquo;</span>
        </p>
      )}

      {!query ? (
        <EmptyState
          title="Start typing to search"
          message="Try a subject name like 'database', a type like 'past paper', or a tag like 'sql'."
        />
      ) : results.length === 0 ? (
        <EmptyState
          title="No results found"
          message={`Nothing matched "${query}". Try a different term or check the spelling.`}
        />
      ) : (
        <>
          <div className="mb-5">
            <FilterChips selected={typeFilter} counts={counts} onChange={setTypeFilter} />
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              title="No results in this category"
              message="Try a different resource type filter."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filtered.map((r) => (
                <ResourceCard key={r.id} resource={r} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
