import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { Resource } from "../../types";
import { RESOURCE_TYPE_CONFIG } from "../../lib/resourceType";
import { cx, formatFileSize } from "../../lib/utils";
import { useLibrary } from "../../state/LibraryProvider";

interface SubjectResourceRowProps {
  resource: Resource;
}

/**
 * Student-only resource row for the Subject Detail page.
 *
 * Clicking anywhere on the row navigates to the separate Student
 * Resource Detail page (/resources/:id) — it never expands inline and
 * never opens the PDF reader directly. The detail page owns the Read
 * action. Icon + type label reuse the Admin resource classification
 * (RESOURCE_TYPE_CONFIG) so Admin "Book" always renders as a Book row.
 */
export function SubjectResourceRow({ resource }: SubjectResourceRowProps) {
  const { markOpened, getProgress } = useLibrary();

  const normalizedType = (resource.type as string) === "other" ? "custom" : resource.type;
  const typeConfig = RESOURCE_TYPE_CONFIG[normalizedType] ?? RESOURCE_TYPE_CONFIG.custom;
  const TypeIcon = typeConfig.icon;
  const progress = getProgress(resource.id);
  // Admin-entered custom label when present, otherwise the existing type label.
  const typeLabel =
    normalizedType === "custom" && resource.customType?.trim()
      ? resource.customType.trim()
      : typeConfig.label;
  // Reuse the category text tint (e.g. "text-primary") so the type
  // label matches its icon container without hardcoding colors.
  const typeTextClass =
    typeConfig.badgeClass.split(" ").find((c) => c.startsWith("text-")) ?? "text-muted-foreground";

  return (
    <li className="card-glow group flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 transition-colors hover:border-primary/30 hover:bg-surface-hover/40">
      <Link
        to={`/resources/${resource.id}`}
        onClick={() => markOpened(resource.id)}
        aria-label={`Open ${resource.title}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <div
          className={cx(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            typeConfig.badgeClass,
          )}
          aria-hidden="true"
        >
          <TypeIcon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <span className="line-clamp-1 block text-sm font-bold text-foreground group-hover:text-primary">
            {resource.title}
          </span>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs font-medium text-muted-foreground">
            <span className={cx("truncate font-semibold", typeTextClass)}>{typeLabel}</span>
            <span aria-hidden="true">·</span>
            <span>PDF</span>
            <span aria-hidden="true">·</span>
            <span>{resource.pageCount} pages</span>
            <span aria-hidden="true">·</span>
            <span>{formatFileSize(resource.fileSize)}</span>
            {resource.paperYear != null && (
              <>
                <span aria-hidden="true">·</span>
                <span>{resource.paperYear}</span>
              </>
            )}
            {progress && (
              <span className="font-bold text-primary">{Math.round(progress.progress * 100)}% read</span>
            )}
          </p>
        </div>

        <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-primary-muted px-3 text-xs font-bold text-primary transition-colors group-hover:bg-primary-muted-hover">
          Open
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}
