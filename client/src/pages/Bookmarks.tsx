import { useMemo, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { BookmarkCard } from "../components/cards/BookmarkCard";
import { SubjectCard } from "../components/cards/SubjectCard";
import { EmptyState } from "../components/common/States";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { Select } from "../components/common/Field";
import { SearchBar } from "../components/common/SearchBar";
import { FilterChips } from "../components/resources/FilterChips";
import { getAllSemesters, getResourceById, getSubjectById, getAllSubjects } from "../data/selectors";
import { useLibrary } from "../state/LibraryProvider";
import { useToast } from "../state/ToastProvider";
import type { ResourceType } from "../types";
import { useCmsSync } from "../components/common/CmsSync";

type SortKey = "recent" | "title" | "pages";

/** True when the text matches any of the fields (case-insensitive). */
function matches(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.trim().toLowerCase());
}

export default function Bookmarks() {
  useCmsSync();
  const { bookmarks, removeBookmark, bookmarkedSubjects } = useLibrary();
  const { toast } = useToast();
  const semesters = getAllSemesters();
  const allSubjects = getAllSubjects();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [type, setType] = useState<ResourceType | "all">("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const allSavedSubjects = useMemo(
    () =>
      bookmarkedSubjects
        .map((id) => getSubjectById(id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    [bookmarkedSubjects],
  );

  const entries = useMemo(
    () =>
      bookmarks
        .map((bm) => ({ bm, resource: getResourceById(bm.resourceId) }))
        .filter((e): e is { bm: (typeof bookmarks)[number]; resource: NonNullable<ReturnType<typeof getResourceById>> } =>
          Boolean(e.resource),
        ),
    [bookmarks],
  );

  const searchedSubjects = useMemo(() => {
    const q = query.trim();
    if (!q) return allSavedSubjects;
    return allSavedSubjects.filter(
      (s) =>
        matches(s.name, q) ||
        matches(s.code, q) ||
        matches(s.description, q) ||
        s.hotTopics.some((t) => matches(t, q)),
    );
  }, [allSavedSubjects, query]);

  const searchedEntries = useMemo(() => {
    const q = query.trim();
    if (!q) return entries;
    return entries.filter(
      ({ bm, resource }) =>
        matches(resource.title, q) ||
        matches(resource.description, q) ||
        resource.tags.some((t) => matches(t, q)) ||
        matches(bm.note, q),
    );
  }, [entries, query]);

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
    let list = searchedEntries;
    if (semesterId) list = list.filter((e) => e.resource.semesterId === semesterId);
    if (subjectId) list = list.filter((e) => e.resource.subjectId === subjectId);
    if (type !== "all") list = list.filter((e) => e.resource.type === type);
    const sorted = [...list];
    if (sort === "title")
      sorted.sort((a, b) => a.resource.title.localeCompare(b.resource.title));
    if (sort === "pages")
      sorted.sort((a, b) => b.resource.pageCount - a.resource.pageCount);
    if (sort === "recent")
      sorted.sort((a, b) => +new Date(b.bm.createdAt) - +new Date(a.bm.createdAt));
    return sorted;
  }, [searchedEntries, semesterId, subjectId, type, sort]);

  const counts = useMemo(() => {
    let base = searchedEntries;
    if (semesterId) base = base.filter((e) => e.resource.semesterId === semesterId);
    if (subjectId) base = base.filter((e) => e.resource.subjectId === subjectId);
    const map: Partial<Record<ResourceType, number>> = {};
    for (const e of base) map[e.resource.type] = (map[e.resource.type] ?? 0) + 1;
    return map;
  }, [searchedEntries, semesterId, subjectId]);

  const isEmpty = bookmarkedSubjects.length === 0 && entries.length === 0;
  const noMatches = !isEmpty && subjects.length === 0 && filtered.length === 0;

  return (
    <div>
      <PageHeader
        title="Saved & Bookmarks"
        subtitle="Pages you saved while reading — available offline."
      />

      {isEmpty ? (
        <EmptyState
          title="No bookmarks yet"
          message="While reading, tap the bookmark icon to save a page or subject for later."
        />
      ) : (
        <>
          <SearchBar
            initialValue={query}
            className="mb-5 max-w-xl"
            placeholder="Search your saved bookmarks..."
            onSubmit={setQuery}
            onChange={setQuery}
          />

          <div className="mb-5 grid grid-cols-2 gap-3 sm:flex sm:flex-nowrap">
            <Select
              id="bookmarks-semester"
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
              id="bookmarks-sort"
              label=""
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full sm:w-48 sm:order-last"
              aria-label="Sort bookmarks"
              options={[
                { value: "recent", label: "Sort by newest" },
                { value: "title", label: "Sort by title" },
                { value: "pages", label: "Sort by page count" },
              ]}
            />
            <Select
              id="bookmarks-subject"
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
              title="No bookmarks found"
              message="No bookmarks match your search or the current filters."
            />
          ) : (
            <>
              {subjects.length > 0 && (
                <section className="mb-8" aria-labelledby="bm-subjects-heading">
                  <h2
                    id="bm-subjects-heading"
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
                <section aria-labelledby="bm-pages-heading">
                  <h2
                    id="bm-pages-heading"
                    className="mb-3 text-base font-bold text-foreground"
                  >
                    Saved Pages ({filtered.length})
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {filtered.map(({ bm, resource }) => (
                      <BookmarkCard key={bm.id} bookmark={bm} resource={resource} onRemove={setPendingDelete} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove bookmark"
        message="This bookmark will be removed from your list. The resource itself is not affected."
        confirmLabel="Remove"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            removeBookmark(pendingDelete);
            toast("Bookmark removed");
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
