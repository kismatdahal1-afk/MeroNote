import { useNavigate } from "react-router-dom";
import {
  GraduationCap, BookOpen, FileStack, HardDriveDownload, Search as SearchIcon, SlidersHorizontal, BadgeCheck,
  AlertTriangle,
} from "lucide-react";
import { Card } from "../components/common/PageHeader";
import { Button } from "../components/common/Button";
import { ExamCard } from "../components/dashboard/ExamCard";
import { StudySummaryGrid } from "../components/dashboard/StudySummaryGrid";
import { ContinueReadingSection, DashboardSectionHeader } from "../components/dashboard/ContinueReadingSection";
import { QuickNavigation, defaultQuickNav } from "../components/dashboard/QuickNavigation";
import { RecentOpenedCard, TrendingResourceCard, TrendingTitle } from "../components/dashboard/TrendingResourceCard";
import { programInfo } from "../data/program";
import { useUser } from "../state/UserProvider";
import { useLibrary } from "../state/LibraryProvider";
import { fetchCount, fetchNotices, fetchResources, fetchResource, fetchSemesters } from "../lib/contentApi";
import { noticeSort, noticeWithState } from "../lib/noticeState";
import { useApiQuery } from "../hooks/useApiQuery";
import { NoticesBoard } from "../components/dashboard/NoticesBoard";
import { formatTimestamp, getGreeting } from "../lib/utils";
import { DashboardSkeleton } from "../components/skeletons/pages";
import { ErrorState } from "../components/common/States";
import type { Resource } from "../types";

export default function Dashboard() {
  const { favorites, favoriteSubjects, bookmarks, bookmarkedSubjects, downloads, recent, progress, libraryError, retryHydration } = useLibrary();
  const { name } = useUser();
  const navigate = useNavigate();

  const board = useApiQuery("dashboard-board", async (signal) => {
    const [semesters, resourcesTotal, notices, pastPapers, recentFallback] = await Promise.all([
      fetchSemesters(signal),
      fetchCount("/api/resources", {}, signal),
      fetchNotices(true, signal),
      fetchResources({ type: "past_paper", limit: 6 }, signal),
      fetchResources({ limit: 6 }, signal),
    ]);
    const subjectTotals = await Promise.all(
      semesters.rows.map((semester) => fetchCount("/api/subjects", { semesterId: semester.id }, signal)),
    );
    return {
      semesters: semesters.rows,
      subjectsTotal: subjectTotals.reduce((sum, n) => sum + n, 0),
      resourcesTotal,
      notices: notices.rows.map(noticeWithState).sort(noticeSort),
      trending: (pastPapers.rows.length > 0 ? pastPapers.rows : recentFallback.rows).slice(0, 3),
    };
  });

  const progressKey = progress.map((p) => `${p.resourceId}:${p.updatedAt}`).join(",");
  const recentKey = recent.map((r) => `${r.resourceId}:${r.openedAt}`).join(",");
  const resolved = useApiQuery(`dashboard-resolved:${progressKey}:${recentKey}`, async (signal) => {
    const sorted = [...progress].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    const heroId = sorted[0]?.resourceId;
    const recentIds = recent.slice(0, 4).map((r) => r.resourceId);
    const ids = [...new Set([heroId, ...recentIds].filter((id): id is string => Boolean(id)))];
    const entries = await Promise.all(
      ids.map(async (id) => {
        try {
          return await fetchResource(id, signal);
        } catch {
          return null;
        }
      }),
    );
    const byId = new Map<string, Resource>();
    for (const resource of entries) {
      if (resource) byId.set(resource.id, resource);
    }
    return { byId, heroId };
  });

  if (board.loading) return <DashboardSkeleton />;
  if (board.error || !board.data) {
    return (
      <div className="py-16">
        <ErrorState message={board.error ?? "Couldn't load the dashboard."} onRetry={board.retry} />
      </div>
    );
  }

  const hero =
    (resolved.data?.heroId ? resolved.data.byId.get(resolved.data.heroId) ?? null : null);
  const heroProgress = hero ? progress.find((p) => p.resourceId === hero.id) : undefined;

  const recentResources = recent
    .slice(0, 4)
    .map((r) => resolved.data?.byId.get(r.resourceId))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .slice(0, 2);

  const trending = board.data.trending;
  /** Permanently downloaded on this device (real IndexedDB state). */
  const completedDownloads = downloads.filter((d) => d.status === "completed").length;
  const notices = board.data.notices;

  const stats = [
    { label: "Semesters", value: board.data.semesters.length, hint: "Syllabus & Qs", icon: GraduationCap },
    { label: "Subjects", value: board.data.subjectsTotal, hint: "Theory & Lab", icon: BookOpen },
    { label: "Archived", value: board.data.resourcesTotal, hint: "Notes & Papers", icon: FileStack },
    { label: "Downloaded", value: completedDownloads, hint: "Offline Ready", icon: HardDriveDownload },
  ];

  /** Quick-nav badges match the Favorite/Bookmark "All" totals (resources + subjects). */
  const quickItems = defaultQuickNav(
    favorites.length + favoriteSubjects.length,
    bookmarks.length + bookmarkedSubjects.length,
  );
  const heroUpdatedAt = heroProgress?.updatedAt;

  return (
    <div className="student-dashboard relative">
      {/* Compact greeting header — the character is absolutely positioned
          so growing it never pushes or squeezes the greeting text. */}
      <header className="relative mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p
            className="font-display animate-fade-up text-2xl font-bold tracking-tight text-foreground motion-reduce:animate-none sm:text-3xl"
            style={{ animationDelay: "0ms" }}
          >
            {getGreeting()},
          </p>
          <p
            className="font-display animate-fade-up mt-0.5 text-2xl font-bold tracking-tight text-primary motion-reduce:animate-none sm:text-3xl"
            style={{ animationDelay: "70ms" }}
          >
            {name.split(" ")[0]}
          </p>
          <p
            className="animate-fade-up mt-1 flex flex-wrap items-center gap-x-1.5 text-sm font-medium text-muted-foreground motion-reduce:animate-none"
            style={{ animationDelay: "140ms" }}
          >
            <span aria-hidden="true" className="sm:hidden">TU</span>
            <span className="hidden sm:inline">{programInfo.university}</span>
            <span aria-hidden="true">•</span>
            <span>{programInfo.program}</span>
            <span aria-hidden="true">•</span>
            <span>{programInfo.batch}</span>
          </p>
        </div>
        {/* Waving character illustration — pinned right, overlaps the gap
            below the header without affecting the text flow. */}
        <img
          src="/images/higesture.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -top-4 right-0 h-[9.45rem] w-auto select-none object-contain drop-shadow-md sm:top-0 sm:h-[12.5rem] lg:right-12 lg:h-[15.25rem]"
          loading="eager"
        />
      </header>

      {/* Exam countdown */}
      <div className="mb-3.5">
        <ExamCard startDelay={210} />
      </div>

      {/* Personalization hydration failure: provider-exclusive state below
          (Continue Reading, Recently Opened) would otherwise look silently
          empty. Other pages fetch independently with their own error states. */}
      {libraryError && (
        <div
          role="alert"
          className="mb-3.5 flex items-center gap-3 rounded-xl border border-error/30 bg-error-muted/30 px-4 py-3"
        >
          <AlertTriangle className="size-5 shrink-0 text-error" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{libraryError}</p>
          <Button variant="outline" size="sm" onClick={retryHydration} className="shrink-0">
            Retry
          </Button>
        </div>
      )}

      {/* Notices & reminders — admin-managed, loaded from the CMS store */}
      <div className="mb-3.5">
        <NoticesBoard notices={notices} plainLabels />
      </div>

      {/* Compact search — redirects to the Search page on Enter */}
      <form
        role="search"
        className="mb-6 flex gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          const q = new FormData(e.currentTarget).get("q");
          const query = typeof q === "string" ? q.trim() : "";
          navigate(query ? `/search?q=${encodeURIComponent(query)}` : "/resources");
        }}
      >
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            name="q"
            placeholder="Search notes, subjects, past questions…"
            aria-label="Search resources"
            className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
        <button
          type="submit"
          aria-label="Search filters"
          className="flex h-10 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <SlidersHorizontal className="size-4.5" aria-hidden="true" />
        </button>
      </form>

      {/* Study summary */}
      <section aria-label="Study summary" className="mb-7">
        <StudySummaryGrid stats={stats} />
      </section>

      {/* Continue reading */}
      <section aria-labelledby="continue-heading" className="mb-7">
        <DashboardSectionHeader
          title={<span id="continue-heading">Continue Reading</span>}
          meta={heroUpdatedAt ? formatTimestamp(heroUpdatedAt) : undefined}
        />
        <ContinueReadingSection resource={hero} />
      </section>

      {/* Quick navigation */}
      <section aria-label="Quick navigation" className="mb-7">
        <QuickNavigation items={quickItems} />
      </section>

      {/* Recently opened */}
      <section aria-labelledby="recent-heading" className="mb-7">
        <DashboardSectionHeader
          title={<span id="recent-heading">Recently Opened</span>}
          actionLabel="See all"
          actionTo="/resources"
        />
        {recentResources.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {recentResources.map((r) => (
              <RecentOpenedCard key={r.id} resource={r} />
            ))}
          </div>
        ) : (
          <Card className="p-5 text-center text-xs font-medium text-muted-foreground">
            Resources you open will show up here.
          </Card>
        )}
      </section>

      {/* Recently added & trending */}
      <section aria-labelledby="trending-heading" className="mb-2">
        <DashboardSectionHeader
          title={
            <span id="trending-heading" className="flex items-center gap-1.5">
              <TrendingTitle />
            </span>
          }
          actionLabel="See all"
          actionTo="/resources?q=exam"
          meta={undefined}
        />
        <div className="mb-3 flex justify-end">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            <BadgeCheck className="size-3" aria-hidden="true" />
            TU CSIT 2081
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {trending.map((r) => (
            <TrendingResourceCard key={r.id} resource={r} />
          ))}
        </div>
      </section>
    </div>
  );
}
