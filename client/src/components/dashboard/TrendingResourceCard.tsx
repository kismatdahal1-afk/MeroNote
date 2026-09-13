import { Link } from "react-router-dom";
import { Play, Download, CheckCircle2, Flame, ShieldCheck, Star } from "lucide-react";
import type { Resource } from "../../types";
import { Card } from "../common/PageHeader";
import { ProgressBar } from "../common/ProgressBar";
import { RESOURCE_TYPE_CONFIG } from "../../lib/resourceType";
import { cx, formatFileSize, formatRelativeTime } from "../../lib/utils";
import { getSubjectById } from "../../data/selectors";
import { useLibrary } from "../../state/LibraryProvider";
import { useToast } from "../../state/ToastProvider";

/** Compact "recently opened" card with progress. */
export function RecentOpenedCard({ resource }: { resource: Resource }) {
  const { getProgress, markOpened } = useLibrary();
  const progress = getProgress(resource.id);
  const typeConfig = RESOURCE_TYPE_CONFIG[resource.type];
  const subject = getSubjectById(resource.subjectId);
  const pct = Math.round((progress?.progress ?? 0) * 100);

  return (
    <Card interactive className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cx("inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold", typeConfig.badgeClass)}>
            {subject?.name}
          </p>
          <Link
            to={`/resources/${resource.id}`}
            onClick={() => markOpened(resource.id)}
            className="mt-1.5 line-clamp-1 block text-sm font-bold text-foreground hover:text-primary"
          >
            {resource.title}
          </Link>
          <p className="mt-0.5 line-clamp-1 text-xs font-medium text-muted-foreground">
            {resource.description}
          </p>
        </div>
        <Link
          to={`/reader/${resource.id}`}
          onClick={() => markOpened(resource.id)}
          aria-label={`Open ${resource.title}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary hover:bg-primary-muted-hover"
        >
          <Play className="size-4 translate-x-px fill-current" aria-hidden="true" />
        </Link>
      </div>
      {progress && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className="text-muted-foreground">Progress</span>
            <span className="text-foreground">{pct}%</span>
          </div>
          <ProgressBar value={progress.progress} label={`Progress ${pct}%`} className="mt-1" />
        </div>
      )}
    </Card>
  );
}

/** Compact trending/resource-discovery card. */
export function TrendingResourceCard({ resource }: { resource: Resource }) {
  const { getDownload, startDownload, markOpened } = useLibrary();
  const { toast } = useToast();
  const typeConfig = RESOURCE_TYPE_CONFIG[resource.type];
  const download = getDownload(resource.id);

  return (
    <Card interactive className="p-4">
      <div className="flex items-start gap-3">
        <div className={cx("flex size-9 shrink-0 items-center justify-center rounded-lg", typeConfig.badgeClass)}>
          <typeConfig.icon className="size-4.5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <Link
            to={`/resources/${resource.id}`}
            onClick={() => markOpened(resource.id)}
            className="line-clamp-1 text-sm font-bold text-foreground hover:text-primary"
          >
            {resource.title}
          </Link>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] font-medium text-muted-foreground">
            <span>PDF</span>
            <span aria-hidden="true">•</span>
            <span>{formatFileSize(resource.fileSize)}</span>
            <span aria-hidden="true">•</span>
            <span className="inline-flex items-center gap-0.5">
              <ShieldCheck className="size-3 text-success" aria-hidden="true" />
              Verified
            </span>
          </p>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground/80">
            Added {formatRelativeTime(resource.uploadedAt)}
          </p>
        </div>
        {download?.status === "completed" ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success-muted text-success">
            <CheckCircle2 className="size-4" aria-hidden="true" />
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Download ${resource.title}`}
            onClick={() => {
              startDownload(resource);
              toast("Download started (mock)");
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Download className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </Card>
  );
}

/** Trending section flame title. */
export function TrendingTitle() {
  return (
    <span className="flex items-center gap-1.5">
      <Flame className="size-4 text-primary" aria-hidden="true" />
      Recently Added &amp; Trending
    </span>
  );
}

/** Star rating display for trending cards (mock rating). */
export function ResourceRating({ rating, count }: { rating: number; count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground">
      <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden="true" />
      {rating.toFixed(1)} ({count})
    </span>
  );
}
