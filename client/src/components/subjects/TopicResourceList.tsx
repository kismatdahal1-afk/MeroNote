import { Link } from "react-router-dom";
import { Download, Eye, Check } from "lucide-react";
import type { Resource } from "../../types";
import { RESOURCE_TYPE_CONFIG } from "../../lib/resourceType";
import { cx, formatFileSize } from "../../lib/utils";
import { Badge } from "../common/Badge";
import { IconButton } from "../common/IconButton";
import { useLibrary } from "../../state/LibraryProvider";
import { useToast } from "../../state/ToastProvider";

interface TopicResourceListProps {
  resources: Resource[];
}

/** Compact resource row shown inside an expanded topic. */
export function TopicResourceList({ resources }: TopicResourceListProps) {
  const { getDownload, startDownload, markOpened, getProgress } = useLibrary();
  const { toast } = useToast();

  if (resources.length === 0) {
    return (
      <p className="rounded-lg bg-surface-muted/60 px-4 py-3 text-sm font-medium text-muted-foreground">
        No resources available for this topic yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {resources.map((r) => {
        const typeConfig = RESOURCE_TYPE_CONFIG[r.type];
        const TypeIcon = typeConfig.icon;
        const download = getDownload(r.id);
        const progress = getProgress(r.id);
        return (
          <li
            key={r.id}
            className="card-glow group flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 transition-colors hover:border-primary/30 hover:bg-surface-hover/40"
          >
            <Link
              to={`/resources/${r.id}`}
              onClick={() => markOpened(r.id)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <div
                className={cx(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  typeConfig.badgeClass,
                )}
                aria-hidden="true"
              >
                <TypeIcon className="size-4.5" />
              </div>

              <div className="min-w-0 flex-1">
                <span className="line-clamp-1 block text-sm font-bold text-foreground group-hover:text-primary">
                  {r.title}
                </span>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs font-medium text-muted-foreground">
                  <span className="truncate">{typeConfig.label}</span>
                  <span aria-hidden="true">·</span>
                  <span>{r.pageCount} pages</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatFileSize(r.fileSize)}</span>
                  {progress && (
                    <span className="font-bold text-primary">{Math.round(progress.progress * 100)}% read</span>
                  )}
                </p>
              </div>
            </Link>

            <div className="flex shrink-0 items-center gap-1.5">
              <Link
                to={`/reader/${r.id}`}
                onClick={() => markOpened(r.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-muted px-3 text-xs font-bold text-primary transition-colors hover:bg-primary-muted-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label={`Read ${r.title}`}
              >
                <Eye className="size-3.5" aria-hidden="true" />
                Read
              </Link>
              {download?.status === "completed" ? (
                <Badge tone="success">
                  <Check className="size-3" aria-hidden="true" />
                  Saved
                </Badge>
              ) : (
                <IconButton
                  icon={Download}
                  label={`Download ${r.title}`}
                  size="sm"
                  onClick={() => {
                    startDownload(r);
                    toast("Download started");
                  }}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
