import { Link } from "react-router-dom";
import { ChevronRight, Heart, Bookmark } from "lucide-react";
import type { Resource } from "../../types";
import { RESOURCE_TYPE_CONFIG } from "../../lib/resourceType";
import { cx, formatFileSize } from "../../lib/utils";
import { IconButton } from "../common/IconButton";
import { useLibrary } from "../../state/LibraryProvider";
import { useToast } from "../../state/ToastProvider";

interface SubjectResourceRowProps {
  resource: Resource;
}

/**
 * Student-only resource row for the Subject Detail page.
 *
 * Clicking navigates to the separate Student Resource Detail page
 * (/resources/:id) — it never expands inline and never opens the PDF
 * reader directly. The detail page owns the Read action. Icon + type
 * label reuse the Admin resource classification (RESOURCE_TYPE_CONFIG)
 * so Admin "Book" always renders as a Book row.
 *
 * Layout: desktop keeps the single horizontal row with an inline Open
 * action; on mobile the row splits into two rows — icon + title +
 * Favorite/Bookmark on the first row, a full-width Open action below.
 */
export function SubjectResourceRow({ resource }: SubjectResourceRowProps) {
  const {
    markOpened,
    getProgress,
    isFavorite,
    toggleFavorite,
    getBookmark,
    addBookmark,
  } = useLibrary();
  const { toast } = useToast();

  const normalizedType = (resource.type as string) === "other" ? "custom" : resource.type;
  const typeConfig = RESOURCE_TYPE_CONFIG[normalizedType] ?? RESOURCE_TYPE_CONFIG.custom;
  const TypeIcon = typeConfig.icon;
  const progress = getProgress(resource.id);
  const favorite = isFavorite(resource.id);
  const bookmarked = Boolean(getBookmark(resource.id));
  // Admin-entered custom label when present, otherwise the existing type label.
  const typeLabel =
    normalizedType === "custom" && resource.customType?.trim()
      ? resource.customType.trim()
      : typeConfig.label;
  // Reuse the category text tint (e.g. "text-primary") so the type
  // label matches its icon container without hardcoding colors.
  const typeTextClass =
    typeConfig.badgeClass.split(" ").find((c) => c.startsWith("text-")) ?? "text-muted-foreground";

  const handleFavorite = () => {
    toggleFavorite(resource.id);
    toast(favorite ? "Removed from favorites" : "Added to favorites");
  };

  const handleBookmark = () => {
    if (bookmarked) {
      toast("Already bookmarked — manage from Bookmarks page", "info");
      return;
    }
    addBookmark(resource, 1, "");
    toast("Bookmark saved (mock)");
  };

  return (
    <li className="card-glow group rounded-xl border border-border bg-surface px-3.5 py-3 transition-colors hover:border-primary/30 hover:bg-surface-hover/40">
      <div className="flex w-full items-center gap-3">
        <Link
          to={`/resources/${resource.id}`}
          onClick={() => markOpened(resource.id)}
          aria-label={`Open ${resource.title}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <div
            className="flex size-10 shrink-0 items-center justify-center"
            aria-hidden="true"
          >
            <TypeIcon className={cx("size-5", typeTextClass)} />
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

          <span className="hidden h-9 shrink-0 items-center gap-1 rounded-lg bg-primary-muted px-3 text-xs font-bold text-primary transition-colors group-hover:bg-primary-muted-hover sm:inline-flex">
            Open
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-0.5 sm:hidden">
          <IconButton
            icon={Heart}
            label={favorite ? "Remove from favorites" : "Add to favorites"}
            size="sm"
            variant={favorite ? "favorite" : "default"}
            filled={favorite}
            aria-pressed={favorite}
            onClick={handleFavorite}
          />
          <IconButton
            icon={Bookmark}
            label={bookmarked ? "Bookmarked" : "Bookmark this resource"}
            size="sm"
            variant={bookmarked ? "bookmark" : "default"}
            filled={bookmarked}
            aria-pressed={bookmarked}
            onClick={handleBookmark}
          />
        </div>
      </div>

      <Link
        to={`/resources/${resource.id}`}
        onClick={() => markOpened(resource.id)}
        aria-label={`Open ${resource.title}`}
        className="mt-2.5 flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-primary-muted text-xs font-bold text-primary transition-colors hover:bg-primary-muted-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:hidden"
      >
        Open
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </Link>
    </li>
  );
}
