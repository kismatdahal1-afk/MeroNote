import { Link } from "react-router-dom";
import { ArrowRight, Heart, Download, GraduationCap, BookOpen } from "lucide-react";
import { Card, StatCard } from "../components/common/PageHeader";
import { ContinueReadingCard } from "../components/cards/ContinueReadingCard";
import { ResourceCard } from "../components/cards/ResourceCard";
import { EmptyState } from "../components/common/States";
import { mockUser, seedProgress } from "../data/mock";
import { getAllSemesters, getResourceById } from "../data/selectors";
import { useLibrary } from "../state/LibraryProvider";
import { formatRelativeTime } from "../lib/utils";

export default function Dashboard() {
  const { favorites, downloads, recent, progress } = useLibrary();

  const continueReading = progress
    .map((p) => ({ progress: p, resource: getResourceById(p.resourceId) }))
    .filter((x): x is { progress: (typeof seedProgress)[number]; resource: NonNullable<ReturnType<typeof getResourceById>> } => Boolean(x.resource))
    .sort((a, b) => +new Date(b.progress.updatedAt) - +new Date(a.progress.updatedAt))
    .slice(0, 4);

  const recentResources = recent
    .slice(0, 8)
    .map((r) => getResourceById(r.resourceId))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  const favoriteResources = favorites
    .slice(0, 4)
    .map((id) => getResourceById(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  const completedDownloads = downloads.filter((d) => d.status === "completed").length;
  const semesters = getAllSemesters();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Welcome back, {mockUser.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Pick up where you left off — your library is ready.
        </p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Semesters" value={semesters.length} icon={<GraduationCap className="size-5" aria-hidden="true" />} />
        <StatCard label="Favorites" value={favorites.length} icon={<Heart className="size-5" aria-hidden="true" />} />
        <StatCard label="Downloads" value={completedDownloads} icon={<Download className="size-5" aria-hidden="true" />} />
        <StatCard label="In Progress" value={progress.length} icon={<BookOpen className="size-5" aria-hidden="true" />} />
      </div>

      {/* Continue reading */}
      <section className="mt-8" aria-labelledby="continue-reading-heading">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 id="continue-reading-heading" className="text-lg font-semibold text-slate-900 dark:text-white">
            Continue Reading
          </h2>
          <Link to="/recent" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Recent <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {continueReading.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {continueReading.map(({ resource }) => (
              <ContinueReadingCard key={resource.id} resource={resource} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nothing in progress"
            message="Open any resource from your semesters and your progress will appear here."
            actionLabel="Browse semesters"
            onAction={() => (window.location.hash = "")}
          />
        )}
      </section>

      {/* Semester shortcuts */}
      <section className="mt-8" aria-labelledby="semesters-heading">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 id="semesters-heading" className="text-lg font-semibold text-slate-900 dark:text-white">
            Semesters
          </h2>
          <Link to="/semesters" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            View all <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {semesters.map((sem) => (
            <Link
              key={sem.id}
              to={`/semesters/${sem.id}`}
              className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center transition-all hover:border-indigo-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-900 dark:hover:border-indigo-500/40"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-indigo-500/10 text-sm font-bold text-indigo-600 transition-transform group-hover:scale-110 dark:bg-indigo-500/15 dark:text-indigo-300">
                {sem.number}
              </span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Sem {sem.number}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent resources */}
      <section className="mt-8" aria-labelledby="recent-heading">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 id="recent-heading" className="text-lg font-semibold text-slate-900 dark:text-white">
            Recent Resources
          </h2>
          <Link to="/recent" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            See all <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {recentResources.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recentResources.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        ) : (
          <EmptyState title="No recent activity" message="Resources you open will show up here." />
        )}
      </section>

      {/* Favorites preview */}
      <section className="mt-8" aria-labelledby="favorites-heading">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 id="favorites-heading" className="text-lg font-semibold text-slate-900 dark:text-white">
            Favorites
          </h2>
          <Link to="/favorites" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            See all <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {favoriteResources.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {favoriteResources.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No favorites yet"
            message="Tap the heart on any resource to keep it here."
            actionLabel="Browse resources"
          />
        )}
      </section>

      {/* Downloads preview */}
      <section className="mt-8" aria-labelledby="downloads-heading">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 id="downloads-heading" className="text-lg font-semibold text-slate-900 dark:text-white">
            Downloads
          </h2>
          <Link to="/downloads" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Manage <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {completedDownloads > 0 ? (
          <Card className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
              <Download className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {completedDownloads} file{completedDownloads === 1 ? "" : "s"} available offline
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Last opened {formatRelativeTime(recent[0]?.openedAt ?? new Date().toISOString())}
              </p>
            </div>
            <Link
              to="/downloads"
              className="ml-auto inline-flex h-9 items-center rounded-lg bg-indigo-600/10 px-3.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-600/20 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
            >
              View downloads
            </Link>
          </Card>
        ) : (
          <EmptyState
            title="No downloads yet"
            message="Download resources to read them even without internet."
          />
        )}
      </section>
    </div>
  );
}
