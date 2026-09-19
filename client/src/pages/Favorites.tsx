import { useMemo, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { ResourceCard } from "../components/cards/ResourceCard";
import { SubjectCard } from "../components/cards/SubjectCard";
import { EmptyState, ErrorState } from "../components/common/States";
import { Select } from "../components/common/Field";
import { SearchBar } from "../components/common/SearchBar";
import { FilterChips, type TypeFilter } from "../components/resources/FilterChips";
import { useTaxonomy } from "../hooks/useTaxonomy";
import { matchesQuery } from "../lib/utils";
import { fetchResource, fetchSemesters, fetchSubject, type SubjectDetail } from "../lib/contentApi";
import { listFavorites, type StudyFavoriteRow } from "../lib/studyApi";
import { favoriteRowToResource, favoriteRowToSubject } from "../lib/personalAdapters";
import { useApiQuery } from "../hooks/useApiQuery";
import { useLibrary } from "../state/LibraryProvider";
import { useUser } from "../state/UserProvider";
import { FavoritesSkeleton } from "../components/skeletons/pages";
import type { Resource, ResourceType } from "../types";

type SortKey = "recent" | "title" | "pages";

export default function Favorites() {
  // Server rows are authoritative when authed; guests keep local-only lists
  // (LibraryProvider) resolved here so logged-out users never see a false
  // empty state after tapping the heart icon.
  const { status } = useUser();
  const { favorites: localFavResourceIds, favoriteSubjects: localFavSubjectIds } = useLibrary();
  const isGuest = status !== "authed";
  const { subjects: taxonomySubjects } = useTaxonomy();
  const [query, setQuery] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const { data, error, loading, retry } = useApiQuery(`me-favorites:${status}`, async (signal) => {
    const [favRows, semesters] = await Promise.all([
      status === "authed" ? listFavorites() : Promise.resolve(null),
      fetchSemesters(signal).catch(() => ({ rows: [], total: 0 })),
    ]);
    return { favRows: favRows ?? [], semesters: semesters.rows };
  });
  const favRows: StudyFavoriteRow[] = useMemo(() => data?.favRows ?? [], [data]);
  const semesters = useMemo(() => data?.semesters ?? [], [data]);

  const localKey = isGuest
    ? [...localFavResourceIds, ...localFavSubjectIds].sort().join(",")
    : "authed";
  const localResolved = useApiQuery(`local-favorites:${localKey}`, async (signal) => {
    if (!isGuest) return null;
    const [resources, subjects] = await Promise.all([
      Promise.all(localFavResourceIds.map((id) => fetchResource(id, signal).catch(() => null))),
      Promise.all(localFavSubjectIds.map((id) => fetchSubject(id, signal).catch(() => null))),
    ]);
    return {
      resources: resources.filter((r): r is Resource => r !== null),
      subjects: subjects.filter((s): s is SubjectDetail => s !== null),
    };
  });
  const showLoading = isGuest ? loading || localResolved.loading : loading;

  const allSubjectsFav = useMemo(() => {
    if (isGuest) return localResolved.data?.subjects ?? [];
    return favRows
      .filter((row) => row.targetType === "subject")
      .map((row) => favoriteRowToSubject(row))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
  }, [isGuest, favRows, localResolved.data]);

  const allResources = useMemo(() => {
    if (isGuest) return localResolved.data?.resources ?? [];
    return favRows
      .filter((row) => row.targetType === "resource")
      .map((row) => favoriteRowToResource(row))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
  }, [isGuest, favRows, localResolved.data]);

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
        ? taxonomySubjects.filter((s) => s.semesterId === semesterId)
        : taxonomySubjects,
    [semesterId, taxonomySubjects],
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

      {showLoading ? (
        <FavoritesSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : isEmpty ? (
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
