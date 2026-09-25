import { Link } from "react-router-dom";
import { Play, List } from "lucide-react";
import type { Resource } from "../../types";
import { Card } from "../common/PageHeader";
import { ProgressBar } from "../common/ProgressBar";
import { RESOURCE_TYPE_CONFIG } from "../../lib/resourceType";
import { cx, formatTimestamp } from "../../lib/utils";
import { useTaxonomy } from "../../hooks/useTaxonomy";
import { useLibrary } from "../../state/LibraryProvider";

/** Primary Continue Reading card — the dashboard's strongest element. */
export function ContinueReadingSection({ resource, onRemove }: { resource: Resource | null; onRemove?: () => void }) {
  const { getProgress, markOpened } = useLibrary();

  if (!resource) {
    return (
      <Card className="p-5 text-center">
        <p className="text-sm font-bold text-foreground">Nothing in progress</p>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          Open any resource and your progress will appear here.
        </p>
      </Card>
    );
  }

  const progress = getProgress(resource.id);
  const typeConfig = RESOURCE_TYPE_CONFIG[resource.type];
  // Icon-only presentation: keep the assigned text color as the Lucide stroke
  // color, with no colored rectangular background behind the icon.
  const typeIconColor = typeConfig.badgeClass
    .split(" ")
    .filter((c) => !c.startsWith("bg-"))
    .join(" ");
  const { subjectName } = useTaxonomy();
  const subject = resource.subjectId ? { name: subjectName(resource.subjectId) } : undefined;
  const lastPage = progress?.lastPage ?? 1;
  const ratio = progress?.progress ?? 0;
  const pct = Math.round(ratio * 100);

  return (
    <Card interactive className="group relative p-4 sm:p-5">
      {/* Stretched link — makes the whole card clickable (opens the reader) */}
      <Link
        to={`/reader/${resource.id}`}
        onClick={() => markOpened(resource.id)}
        aria-label={`Resume ${resource.title} at page ${lastPage}`}
        className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
      {/* Single layout on all screens — identical UI on mobile and laptop,
          compact on small screens via the card padding above. */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
            {typeConfig.label}
          </p>
          <h3 className="mt-1 line-clamp-1 text-base font-bold leading-tight text-foreground group-hover:text-primary">
            {resource.title}
          </h3>
          <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
            {subject?.name}
          </p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center">
          <typeConfig.icon className={cx("size-5", typeIconColor)} aria-hidden="true" />
        </div>
      </div>

      <p className="mt-2.5 truncate text-xs font-medium leading-relaxed text-muted-foreground">
        {resource.description}
      </p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-foreground">
            Page {lastPage} of {resource.pageCount}
          </span>
          <span className="text-muted-foreground">{pct}% Completed</span>
        </div>
        <ProgressBar value={ratio} label={`Reading progress ${pct}%`} className="mt-1.5" />
      </div>

      <div className="relative z-10 mt-4 flex items-center gap-2.5">
        <Link
          to={`/reader/${resource.id}`}
          onClick={() => markOpened(resource.id)}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={`Resume ${resource.title} at page ${lastPage}`}
        >
          <Play className="size-4 fill-current" aria-hidden="true" />
          Resume Page {lastPage}
        </Link>
        <Link
          to={`/resources/${resource.id}`}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong px-4 text-sm font-bold text-foreground transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <List className="size-4" aria-hidden="true" />
          Index
        </Link>
      </div>
      {onRemove && (
        <div className="relative z-10 mt-2.5 flex justify-end">
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${resource.title} from Continue Reading`}
            className="rounded-md px-2 py-1 text-xs font-bold text-muted-foreground transition-colors hover:text-error focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Remove from Continue Reading
          </button>
        </div>
      )}
    </Card>
  );
}

/** Section header row with title and right-side meta/link. */
export function DashboardSectionHeader({
  title,
  meta,
  actionLabel,
  actionTo,
}: {
  title: React.ReactNode;
  meta?: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-bold text-foreground">{title}</h2>
      <div className="flex shrink-0 items-center gap-2.5">
        {meta && <span className="text-xs font-medium text-muted-foreground">{meta}</span>}
        {actionLabel && actionTo && (
          <Link to={actionTo} className="text-xs font-bold text-primary hover:underline">
            {actionLabel} →
          </Link>
        )}
      </div>
    </div>
  );
}

/** Timestamp helper re-export for "Today, 8:15 AM" section meta. */
export { formatTimestamp };
