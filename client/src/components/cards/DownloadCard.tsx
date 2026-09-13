import { Link } from "react-router-dom";
import { Trash2, Eye, CheckCircle2, Loader2 } from "lucide-react";
import type { DownloadItem, Resource } from "../../types";
import { Card } from "../common/PageHeader";
import { ProgressBar } from "../common/ProgressBar";
import { RESOURCE_TYPE_CONFIG } from "../../lib/resourceType";
import { cx, formatFileSize, formatRelativeTime } from "../../lib/utils";
import { getSubjectById, getSemesterById } from "../../data/selectors";
import { useLibrary } from "../../state/LibraryProvider";
import { IconButton } from "../common/IconButton";

interface DownloadCardProps {
  download: DownloadItem;
  resource: Resource;
  onRemove: (downloadId: string) => void;
}

/** Card form of a downloaded resource — mirrors ResourceCard/BookmarkCard layout. */
export function DownloadCard({ download, resource, onRemove }: DownloadCardProps) {
  const { markOpened } = useLibrary();

  const typeConfig = RESOURCE_TYPE_CONFIG[resource.type];
  const TypeIcon = typeConfig.icon;
  const subject = getSubjectById(resource.subjectId);
  const semester = getSemesterById(resource.semesterId);
  const completed = download.status === "completed";

  return (
    <Card interactive className="group relative flex h-full flex-col p-5">
      {/* Stretched link — makes the whole card clickable */}
      <Link
        to={`/resources/${resource.id}`}
        aria-label={`Open ${resource.title}`}
        className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", typeConfig.badgeClass)}>
            <TypeIcon className="size-5" aria-hidden="true" />
          </div>
          <span className={cx("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", typeConfig.badgeClass)}>
            {typeConfig.label}
          </span>
        </div>
        <IconButton
          icon={Trash2}
          label={`Delete ${resource.title} from downloads`}
          size="sm"
          variant="danger"
          onClick={() => onRemove(download.id)}
        />
      </div>

      <div className="mt-3 flex min-w-0 flex-1 flex-col">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground group-hover:text-primary">
          {resource.title}
        </h3>
        {(subject || semester) && (
          <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
            {[subject?.name, semester?.name].filter(Boolean).join(" · ")
            }
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {resource.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-[#1e3a8a] dark:text-[#00FFF5]"
          >
            {tag}
          </span>
        ))}
      </div>

      {download.status === "downloading" && (
        <div className="mt-3 flex items-center gap-2.5">
          <ProgressBar value={download.progress / 100} label={`Download progress ${download.progress}%`} className="max-w-48" />
          <span className="text-xs font-bold text-primary">{download.progress}%</span>
        </div>
      )}

      <div className="relative z-10 mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs font-medium text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {completed ? (
            <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
          )}
          <span className="truncate">
            {completed
              ? `${formatFileSize(download.sizeBytes)} · ${formatRelativeTime(download.downloadedAt)}`
              : download.status === "failed"
                ? "Failed"
                : "Downloading…"}
          </span>
        </span>
        {completed && (
          <Link
            to={`/reader/${resource.id}`}
            onClick={() => markOpened(resource.id)}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary-muted px-2.5 text-xs font-bold text-primary transition-colors hover:bg-primary-muted-hover"
            aria-label={`Open ${resource.title}`}
          >
            <Eye className="size-3.5" aria-hidden="true" />
            Read
          </Link>
        )}
      </div>
    </Card>
  );
}
