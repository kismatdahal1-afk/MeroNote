import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  GraduationCap, BookOpen, FileStack, HardDriveDownload, Search as SearchIcon, SlidersHorizontal, BadgeCheck, Wifi, WifiOff,
} from "lucide-react";
import { Card } from "../components/common/PageHeader";
import { ExamCard } from "../components/dashboard/ExamCard";
import { StudySummaryGrid } from "../components/dashboard/StudySummaryGrid";
import { ContinueReadingSection, DashboardSectionHeader } from "../components/dashboard/ContinueReadingSection";
import { QuickNavigation, defaultQuickNav } from "../components/dashboard/QuickNavigation";
import { RecentOpenedCard, TrendingResourceCard, TrendingTitle } from "../components/dashboard/TrendingResourceCard";
import { Badge } from "../components/common/Badge";
import { mockUser, programInfo } from "../data/mock";
import {
  getAllSemesters,
  getResourceById,
  countCoreSubjects,
  getTrendingExamResources,
} from "../data/selectors";
import { useLibrary } from "../state/LibraryProvider";
import { formatTimestamp } from "../lib/utils";

export default function Dashboard() {
  const { favorites, bookmarks, downloads, recent, progress } = useLibrary();
  const navigate = useNavigate();

  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const hero =
    progress
      .map((p) => ({ p, resource: getResourceById(p.resourceId) }))
      .filter((x) => x.resource)
      .sort((a, b) => +new Date(b.p.updatedAt) - +new Date(a.p.updatedAt))[0]?.resource ?? null;

  const recentResources = recent
    .slice(0, 4)
    .map((r) => getResourceById(r.resourceId))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .slice(0, 2);

  const trending = getTrendingExamResources().slice(0, 3);
  const completedDownloads = downloads.filter((d) => d.status === "completed").length;
  const semesters = getAllSemesters();

  const stats = [
    { label: "Semesters", value: semesters.length, hint: "Syllabus & Past Qs", icon: GraduationCap },
    { label: "Curriculum", value: countCoreSubjects(), hint: "Theory & Practicals", icon: BookOpen },
    { label: "Archived", value: "420+", hint: "Handwritten & Slides", icon: FileStack },
    { label: "Saved", value: completedDownloads, hint: "Offline Ready", icon: HardDriveDownload },
  ];

  const quickItems = defaultQuickNav(favorites.length, bookmarks.length);
  const heroUpdatedAt = hero ? progress.find((p) => p.resourceId === hero.id)?.updatedAt : undefined;

  return (
    <div>
      {/* Compact greeting header */}
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Good morning, {mockUser.name.split(" ")[0]} 👋
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm font-medium text-muted-foreground">
            <span>{programInfo.university}</span>
            <span aria-hidden="true">•</span>
            <span>{programInfo.program}</span>
            <span aria-hidden="true">•</span>
            <span>{programInfo.batch}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <span
            role="status"
            aria-live="polite"
            className={
              online
                ? "inline-flex items-center gap-1.5 rounded-full bg-success-muted px-2.5 py-1 text-xs font-bold text-success"
                : "inline-flex items-center gap-1.5 rounded-full bg-warning-muted px-2.5 py-1 text-xs font-bold text-warning"
            }
          >
            {online ? (
              <Wifi className="size-3.5" aria-hidden="true" />
            ) : (
              <WifiOff className="size-3.5" aria-hidden="true" />
            )}
            {online ? "Online" : "Offline"}
          </span>
        </div>
      </header>

      {/* Exam countdown */}
      <div className="mb-3.5">
        <ExamCard />
      </div>

      {/* Compact search */}
      <form
        role="search"
        className="mb-6 flex gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          navigate("/search");
        }}
      >
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search notes, past questions, algorithms..."
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
          actionTo="/recent"
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
          actionTo="/search?q=exam"
          meta={undefined}
        />
        <div className="mb-3 flex justify-end">
          <Badge tone="primary">
            <BadgeCheck className="size-3" aria-hidden="true" />
            TU CSIT 2081
          </Badge>
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
