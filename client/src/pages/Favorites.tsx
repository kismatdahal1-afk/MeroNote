import { useMemo, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { ResourceCard } from "../components/cards/ResourceCard";
import { SubjectCard } from "../components/cards/SubjectCard";
import { EmptyState } from "../components/common/States";
import { Select } from "../components/common/Field";
import { SearchBar } from "../components/common/SearchBar";
import { FilterChips } from "../components/resources/FilterChips";
import { getAllSemesters, getResourceById, getSubjectById, getAllSubjects } from "../data/selectors";
import { useLibrary } from "../state/LibraryProvider";
import type { ResourceType } from "../types";
import { useCmsSync } from "../components/common/CmsSync";

type SortKey = "recent" | "title" | "pages";

/** True when the text matches any of the fields (case-insensitive). */
function matches(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.trim().toLowerCase());
}

export default function Favorites() {
  useCmsSync();
  const { favorites, favoriteSubjects } = useLibrary();
  const semesters = getAllSemesters();
  const allSubjects = getAllSubjects();

  const [query, setQuery] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [type, setType] = useState<ResourceType | "all">("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const allSubjectsFav = useMemo(
    () =>
      favoriteSubjects
        .map((id) => getSubjectById(id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    [favoriteSubjects],
  );

  const allResources = useMemo(
    () =>
      favorites
        .map((id) => getResourceById(id))
        .filter((r): r is NonNullable<typeof r> => Boolean(r)),
    [favorites],
  );

  const searchedSubjects = useMemo(() => {
    const q = query.trim();
    if (!q) return allSubjectsFav;
    return allSubjectsFav.filter(
      (s) =>
        matches(s.name, q) ||
        matches(s.code, q) ||
        matches(s.description, q) ||
        s.hotTopics.some((t) => matches(t, q)),
    );
  }, [allSubjectsFav, query]);

  const searchedResources = useMemo(() => {
    const q = query.trim();
    if (!q) return allResources;
    return allResources.filter(
      (r) =>
        matches(r.title, q) ||
        matches(r.description, q) ||
        r.tags.some((t) => matches(t, q)),
    );
  }, [allResources, query]);

  const subjects = useMemo(
    () => searchedSubjects.filter((s) => !semesterId || s.semesterId === semesterId),
    [searchedSubjects, semesterId],
  );

  const subjectOptions = useMemo(
    () =>
      semesterId
        ? allSubjects.filter((s) => s.semesterId === semesterId)
        : allSubjects,
    [semesterId],
  );

  const filtered = useMemo(() => {
    let list = searchedResources;
    if (semesterId) list = list.filter((r) => r.semesterId === semesterId);
    if (subjectId) list = list.filter((r) => r.subjectId === subjectId);
    if (type !== "all") list = list.filter((r) => r.type === type);
    const sorted = [...list];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "pages") sorted.sort((a, b) => b.pageCount - a.pageCount);
    if (sort === "recent")
      sorted.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
    return sorted;
  }, [searchedResources, semesterId, subjectId, type, sort]);

  const counts = useMemo(() => {
    let base = searchedResources;
    if (semesterId) base = base.filter((r) => r.semesterId === semesterId);
    if (subjectId) base = base.filter((r) => r.subjectId === subjectId);
    const map: Partial<Record<ResourceType, number>> = {};
    for (const r of base) map[r.type] = (map[r.type] ?? 0) + 1;
    return map;
  }, [searchedResources, semesterId, subjectId]);

  const isEmpty = favoriteSubjects.length === 0 && allResources.length === 0;
  const noMatches = !isEmpty && subjects.length === 0 && filtered.length === 0;

  return (
    <div>
      <PageHeader
        title="Favorites"
        subtitle="Subjects and resources you've marked for quick access."
      />

      {isEmpty ? (
        <EmptyState
          title="No favorites yet"
          message="Tap the heart icon on any subject or resource and it will appear here."
        />
      ) : (
        <>
          <SearchBar
            initialValue={query}
            className="mb-5 max-w-xl"
            placeholder="Search your favorites..."
            onSubmit={setQuery}
            onChange={setQuery}
          />

          <div className="mb-5 grid grid-cols-2 gap-3 sm:flex sm:flex-nowrap">
            <Select
              id="favorites-semester"
              label=""
              value={semesterId}
              onChange={(e) => {
                setSemesterId(e.target.value);
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
              id="favorites-sort"
              label=""
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full sm:w-48 sm:order-last"
              aria-label="Sort favorites"
              options={[
                { value: "recent", label: "Sort by newest" },
                { value: "title", label: "Sort by title" },
                { value: "pages", label: "Sort by page count" },
              ]}
            />
            <Select
              id="favorites-subject"
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

          {noMatches ? (
            <EmptyState
              title="No favorites found"
              message="No favorites match your search or the current filters."
            />
          ) : (
            <>
              {subjects.length > 0 && (
                <section className="mb-8" aria-labelledby="fav-subjects-heading">
                  <h2
                    id="fav-subjects-heading"
                    className="mb-3 text-base font-bold text-foreground"
                  >
                    Subjects ({subjects.length})
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {subjects.map((s) => (
                      <SubjectCard key={s.id} subject={s} />
                    ))}
                  </div>
                </section>
              )}
              {filtered.length > 0 && (
                <section aria-labelledby="fav-resources-heading">
                  <h2
                    id="fav-resources-heading"
                    className="mb-3 text-base font-bold text-foreground"
                  >
                    Resources ({filtered.length})
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {filtered.map((r) => (
                      <ResourceCard key={r.id} resource={r} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
