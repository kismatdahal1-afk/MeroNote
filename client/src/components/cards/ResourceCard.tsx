import { Link } from "react-router-dom";
import { Heart, Bookmark, Download, Eye, Check, ChevronRight } from "lucide-react";
import type { Resource } from "../../types";
import { Card } from "../common/PageHeader";
import { RESOURCE_TYPE_CONFIG } from "../../lib/resourceType";
import { ProgressBar } from "../common/ProgressBar";
import { cx, formatFileSize } from "../../lib/utils";
import { getSubjectById, getSemesterById } from "../../data/selectors";
import type { ResourceEntryPoint } from "../../lib/resourceNavigation";
import { useLibrary } from "../../state/LibraryProvider";
import { useToast } from "../../state/ToastProvider";
import { IconButton } from "../common/IconButton";

interface ResourceCardProps {
  resource: Resource;
  /** show subject/semester line (used on dashboard/search results) */
  showContext?: boolean;
  /** Navigation entry point for the detail/reader breadcrumb.
   *  Omitted inside Semester flows, which keep the Semester trail. */
  via?: ResourceEntryPoint;
}

export function ResourceCard({ resource, showContext = true, via }: ResourceCardProps) {
  const { isFavorite, toggleFavorite, getBookmark, addBookmark, getDownload, startDownload, getProgress } = useLibrary();
  const { toast } = useToast();

  const typeConfig = RESOURCE_TYPE_CONFIG[resource.type];
  const TypeIcon = typeConfig.icon;
  const subject = getSubjectById(resource.subjectId);
  const semester = getSemesterById(resource.semesterId);
  const favorite = isFavorite(resource.id);
  const bookmarked = Boolean(getBookmark(resource.id));
  const download = getDownload(resource.id);
  const progress = getProgress(resource.id);

  const handleFavorite = () => {
    toggleFavorite(resource.id);
    toast(favorite ? "Removed from favorites" : "Added to favorites");
  };

  const handleBookmark = () => {
    if (bookmarked) {
      toast("Already bookmarked — remove it from the Bookmarks page", "info");
      return;
    }
    addBookmark(resource, 1, "");
    toast("Bookmark saved (mock)");
  };

  const handleDownload = () => {
    if (download?.status === "completed" || download?.status === "downloading") {
      toast("Download already in progress or completed", "info");
      return;
    }
    startDownload(resource);
    toast("Download started (mock)");
  };

  return (
    <Card interactive className="group relative flex h-full flex-col p-4 sm:p-5">
      {/* Stretched link — makes the whole card clickable */}
      <Link
        to={`/resources/${resource.id}`}
        state={via ? { via } : undefined}
        aria-label={`Open ${resource.title}`}
        className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
      <div className="relative z-10 flex items-start justify-between gap-3 sm:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className={cx("flex size-9 shrink-0 items-center justify-center rounded-lg", typeConfig.badgeClass)}>
            <TypeIcon className="size-4.5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-bold leading-snug text-foreground">
              {resource.title}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
              {typeConfig.label} · {resource.pageCount} pages · {formatFileSize(resource.fileSize)}
            </p>
            {showContext && (subject || semester) && (
              <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground/80">
                {[subject?.name, semester?.name].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
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
            label={bookmarked ? "Bookmarked" : "Bookmark first page"}
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
        state={via ? { via } : undefined}
        aria-label={`Open ${resource.title}`}
        className="relative z-10 mt-2.5 flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-primary-muted text-xs font-bold text-primary transition-colors hover:bg-primary-muted-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:hidden"
      >
        Open
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </Link>

      {/* Desktop card body — unchanged, hidden on mobile. */}
      <div className="hidden sm:contents">
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cx("flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10", typeConfig.badgeClass)}>
            <TypeIcon className="size-5" aria-hidden="true" />
          </div>
          <span className={cx("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", typeConfig.badgeClass)}>
            {typeConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
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
            label={bookmarked ? "Bookmarked" : "Bookmark first page"}
            size="sm"
            variant={bookmarked ? "bookmark" : "default"}
            filled={bookmarked}
            aria-pressed={bookmarked}
            onClick={handleBookmark}
          />
        </div>
      </div>

      <div className="mt-2.5 flex min-w-0 flex-1 flex-col sm:mt-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground group-hover:text-primary">
          {resource.title}
        </h3>
        {showContext && (subject || semester) && (
          <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
            {[subject?.name, semester?.name].filter(Boolean).join(" · ")
            }
          </p>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3">
        {resource.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-[#1e3a8a] dark:text-[#00FFF5]"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Reading progress where available */}
      {progress && (
        <div className="mt-2.5 sm:mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold">
            <span className="text-muted-foreground">
              Page {progress.lastPage} of {resource.pageCount}
            </span>
            <span className="text-primary">{Math.round(progress.progress * 100)}%</span>
          </div>
          <ProgressBar
            value={progress.progress}
            label={`Reading progress for ${resource.title}`}
          />
        </div>
      )}

      <div className="relative z-10 mt-3 flex items-center justify-between border-t border-border pt-3 text-xs font-medium text-muted-foreground sm:mt-4">
        <span>
          {resource.pageCount} pages · {formatFileSize(resource.fileSize)}
        </span>
        <div className="flex items-center gap-1">
          <Link
            to={`/reader/${resource.id}`}
            state={via ? { via } : undefined}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary-muted px-2.5 text-xs font-bold text-primary transition-colors hover:bg-primary-muted-hover"
            aria-label={`Open ${resource.title} in reader`}
          >
            <Eye className="size-3.5" aria-hidden="true" />
            Read
          </Link>
          {download?.status === "completed" ? (
            <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-success-muted px-2.5 text-xs font-bold text-success">
              <Check className="size-3.5" aria-hidden="true" />
              Saved
            </span>
          ) : (
            <IconButton
              icon={Download}
              label={`Download ${resource.title}`}
              size="sm"
              onClick={handleDownload}
            />
          )}
        </div>
      </div>
      </div>
    </Card>
  );
}
