import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { GraduationCap, BookOpen, FileStack, Search, SlidersHorizontal } from "lucide-react";
import { SemesterCard } from "../components/cards/SemesterCard";
import { SubjectCard } from "../components/cards/SubjectCard";
import { ResourceCard } from "../components/cards/ResourceCard";
import { PageHeader, Card } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/States";
import { BackButton } from "../components/common/BackButton";
import { ActiveSemesterBanner } from "../components/semesters/ActiveSemesterBanner";
import { SemesterStatusControl, type SemesterStatusKind } from "../components/semesters/SemesterStatus";
import { StatPill as SemesterStatPill } from "../components/semesters/StatPill";
import { FilterChips } from "../components/resources/FilterChips";
import { useSemesterStatus } from "../state/SemesterStatusProvider";
import {
  getSemesterById,
  getSubjectsBySemester,
  getAllSemesters,
  getResourcesBySemester,
} from "../data/selectors";
import type { ResourceType } from "../types";
import { useCmsSync } from "../components/common/CmsSync";

export default function Semesters() {
  useCmsSync();
  const { ongoingSemesterId } = useSemesterStatus();

  return (
    <div>
      <PageHeader
        title="Semester Library"
        subtitle="Your complete CSIT curriculum — semester by semester."
      />

      {/* Ongoing semester banner (renders only while a semester is Ongoing) */}
      {ongoingSemesterId && <ActiveSemesterBanner semesterId={ongoingSemesterId} />}

      <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        {getAllSemesters().map((sem) => (
          <SemesterCard key={sem.id} semester={sem} />
        ))}
      </div>
    </div>
  );
}

export function SemesterSubjects() {
  const cmsDb = useCmsSync();
  const { semesterId } = useParams<{ semesterId: string }>();
  const navigate = useNavigate();
  const { getStatus, setStatus } = useSemesterStatus();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ResourceType | "all">("all");

  const semester = getSemesterById(semesterId);
  const subjects = useMemo(
    () => (semester ? getSubjectsBySemester(semester.id) : []),
    // cmsDb: re-resolve after CMS mutations so edits/deletions show immediately.
    [semester, cmsDb],
  );
  /** Semester resources, most recently added first. */
  const recentResources = useMemo(
    () =>
      semester
        ? [...getResourcesBySemester(semester.id)].sort(
            (a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt),
          )
        : [],
    // cmsDb: re-resolve after CMS mutations so edits/deletions show immediately.
    [semester, cmsDb],
  );

  const filteredSubjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.hotTopics.some((t) => t.toLowerCase().includes(q)),
    );
  }, [subjects, query]);

  const filteredResources = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = recentResources;
    if (q) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (type !== "all") list = list.filter((r) => r.type === type);
    return list;
  }, [recentResources, query, type]);

  const typeCounts = useMemo(() => {
    const map: Partial<Record<ResourceType, number>> = {};
    for (const r of recentResources) map[r.type] = (map[r.type] ?? 0) + 1;
    return map;
  }, [recentResources]);

  if (!semester) {
    return (
      <div className="py-16 text-center font-medium text-muted-foreground">
        Semester not found.{" "}
        <button type="button" onClick={() => navigate("/semesters")} className="font-bold text-primary hover:underline">
          Back to semesters
        </button>
      </div>
    );
  }

  const status = getStatus(semester.id) as SemesterStatusKind;
  const ongoing = status === "ongoing";
  const showingAll = !query.trim() && type === "all";

  const handleStatusChange = (next: SemesterStatusKind) => {
    setStatus(semester.id, next);
  };

  return (
    <div>
      <div className="mb-1 -ml-1 sm:-ml-1">
        <BackButton fallbackTo="/semesters" label="Back to semesters" />
      </div>
      <PageHeader
        title={semester.name}
        subtitle={semester.description}
        compactBreadcrumb
        breadcrumbs={[
          { label: "Semester", to: "/semesters" },
          { label: semester.name },
        ]}
        actions={
          <SemesterStatusControl
            status={status}
            onChange={handleStatusChange}
          />
        }
      />

      {/* Semester facts — the ongoing semester reuses the shared library banner */}
      {ongoing ? (
        <ActiveSemesterBanner semesterId={semester.id} showLauncher={false} />
      ) : (
        <Card className="mb-6 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <SemesterStatPill
              icon={<GraduationCap className="size-3" aria-hidden="true" />}
              label="Program"
              value="BSc CSIT"
            />
            <SemesterStatPill
              icon={<FileStack className="size-3" aria-hidden="true" />}
              label="Subjects"
              value={subjects.length}
            />
            <SemesterStatPill
              icon={<BookOpen className="size-3" aria-hidden="true" />}
              label="Resources"
              value={recentResources.length}
            />
            <SemesterStatPill
              icon={<GraduationCap className="size-3" aria-hidden="true" />}
              label="Credits"
              value={semester.credits}
            />
          </div>
        </Card>
      )}

      {/* Compact search */}
      <form
        role="search"
        className="mb-5 flex gap-2.5"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subjects, books, notes, past questions..."
            aria-label="Search subjects, books, notes, past questions"
            className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
        <button
          type="button"
          aria-label="Search filters"
          title="Filters"
          onClick={() => setType(type === "all" ? "book" : "all")}
          className={
            "flex h-10 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
            (type !== "all"
              ? "border-primary/40 bg-primary-muted text-primary"
              : "border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground")
          }
        >
          <SlidersHorizontal className="size-4.5" aria-hidden="true" />
        </button>
      </form>

      {/* Subjects section */}
      <section aria-labelledby="sem-subjects-heading" className="mb-7">
        <h2 id="sem-subjects-heading" className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Subjects
          <span className="ml-1.5 font-semibold normal-case text-muted-foreground/70">
            ({filteredSubjects.length})
          </span>
        </h2>
        {filteredSubjects.length === 0 ? (
          <EmptyState
            title="No matching subjects"
            message="Try a different search term."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredSubjects.map((subject) => (
              <SubjectCard key={subject.id} subject={subject} />
            ))}
          </div>
        )}
      </section>

      {/* Semester resources — 8 most recently added */}
      <section aria-labelledby="sem-resources-heading">
        <h2 id="sem-resources-heading" className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Resources
          <span className="ml-1.5 font-semibold normal-case text-muted-foreground/70">
            ({filteredResources.length})
          </span>
        </h2>

        <div className="mb-4">
          <FilterChips
            selected={type}
            counts={typeCounts}
            onChange={setType}
          />
        </div>

        {filteredResources.length === 0 ? (
          <EmptyState
            title={showingAll ? "No resources yet" : "No matching resources"}
            message={
              showingAll
                ? "Resources for this semester will appear here."
                : "Try a different search term or filter."
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {filteredResources.slice(0, 8).map((r) => (
              <ResourceCard key={r.id} resource={r} showContext={false} />
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Link
            to="/resources"
            className="inline-flex items-center gap-1 rounded-lg text-sm font-bold text-primary transition-colors hover:text-primary-hover hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            More resources →
          </Link>
        </div>
      </section>
    </div>
  );
}
