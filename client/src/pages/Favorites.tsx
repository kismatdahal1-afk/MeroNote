import { useMemo, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { ResourceCard } from "../components/cards/ResourceCard";
import { SubjectCard } from "../components/cards/SubjectCard";
import { EmptyState } from "../components/common/States";
import { Select } from "../components/common/Field";
import { SearchBar } from "../components/common/SearchBar";
import { FilterChips, type TypeFilter } from "../components/resources/FilterChips";
import { getAllSemesters, getResourceById, getSubjectById, getAllSubjects } from "../data/selectors";
import { useLibrary } from "../state/LibraryProvider";
import { matchesQuery } from "../lib/utils";
import type { ResourceType } from "../types";
import { useCmsSync } from "../components/common/CmsSync";

type SortKey = "recent" | "title" | "pages";

export default function Favorites() {
  const cmsDb = useCmsSync();
  const { favorites, favoriteSubjects } = useLibrary();
  const semesters = getAllSemesters();
  const allSubjects = getAllSubjects();

  const [query, setQuery] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const allSubjectsFav = useMemo(
    () =>
      favoriteSubjects
        .map((id) => getSubjectById(id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    // cmsDb: re-resolve after CMS mutations so edits/deletions show immediately.
    [favoriteSubjects, cmsDb],
  );

  const allResources = useMemo(
    () =>
      favorites
        .map((id) => getResourceById(id))
        .filter((r): r is NonNullable<typeof r> => Boolean(r)),
    [favorites, cmsDb],
  );

  const searchedSubjects = useMemo(() => {
    const q = query.trim();
    if (!q) return allSubjectsFav;
    return allSubjectsFav.filter(
      (s) =>
        matchesQuery(s.name, q) ||
        matchesQuery(s.code, q) ||
        matchesQuery(s.description, q) ||
        s.hotTopics.some((t) => matchesQuery(t, q)),
    );
  }, [allSubjectsFav, query]);

  const searchedResources = useMemo(() => {
    const q = query.trim();
    if (!q) return allResources;
    return allResources.filter(
      (r) =>
        matchesQuery(r.title, q) ||
        matchesQuery(r.description, q) ||
        r.tags.some((t) => matchesQuery(t, q)),
    );
  }, [allResources, query]);

  const subjects = useMemo(
    () =>
      searchedSubjects.filter(
        (s) =>
          (!semesterId || s.semesterId === semesterId) &&
          (!subjectId || s.id === subjectId),
      ),
    [searchedSubjects, semesterId, subjectId],
  );

  const subjectOptions = useMemo(
    () =>
      semesterId
        ? allSubjects.filter((s) => s.semesterId === semesterId)
        : allSubjects,
    [semesterId, allSubjects],
  );

  const filtered = useMemo(() => {
    let list = searchedResources;
    if (semesterId) list = list.filter((r) => r.semesterId === semesterId);
    if (subjectId) list = list.filter((r) => r.subjectId === subjectId);
    if (type !== "all" && type !== "subjects") list = list.filter((r) => r.type === type);
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

  const isEmpty = allSubjectsFav.length === 0 && allResources.length === 0;
  /** "subjects" shows only subjects; a resource type shows only that type; "all" shows both. */
  const showSubjectsSection = (type === "all" || type === "subjects") && subjects.length > 0;
  const showResourcesSection = type !== "subjects" && filtered.length > 0;
  const noMatches = !isEmpty && !showSubjectsSection && !showResourcesSection;

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
            <FilterChips
              selected={type}
              counts={counts}
              showSubjects
              subjectsCount={allSubjectsFav.length}
              allCount={allSubjectsFav.length + allResources.length}
              onChange={setType}
            />
          </div>

          {noMatches ? (
            <EmptyState
              title="No favorites found"
              message="No favorites match your search or the current filters."
            />
          ) : (
            <>
              {showSubjectsSection && (
                <section className="mb-8" aria-labelledby="fav-subjects-heading">
                  <h2
                    id="fav-subjects-heading"
                    className="mb-3 text-base font-bold text-foreground"
                  >
                    Subjects ({subjects.length})
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {subjects.map((s) => (
                      <SubjectCard key={s.id} subject={s} via="favorites" />
                    ))}
                  </div>
                </section>
              )}
              {showResourcesSection && (
                <section aria-labelledby="fav-resources-heading">
                  <h2
                    id="fav-resources-heading"
                    className="mb-3 text-base font-bold text-foreground"
                  >
                    Resources ({filtered.length})
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {filtered.map((r) => (
                        <ResourceCard key={r.id} resource={r} via="favorites" />
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
