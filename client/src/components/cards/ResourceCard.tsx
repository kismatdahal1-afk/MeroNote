import { Link } from "react-router-dom";
import { Heart, Bookmark, Download, Eye, Check, ChevronRight, Loader2, RotateCcw, X } from "lucide-react";
import type { Resource } from "../../types";
import { Card } from "../common/PageHeader";
import { RESOURCE_TYPE_CONFIG } from "../../lib/resourceType";
import { ProgressBar } from "../common/ProgressBar";
import { cx, formatFileSize } from "../../lib/utils";
import { useTaxonomy } from "../../hooks/useTaxonomy";
import { buildResourceNavState, type ResourceEntryPoint } from "../../lib/resourceNavigation";
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
  /** Subject the user navigated through (set only by Subject pages, so
   *  detail/reader can show Favorites → Subject → Resource when the
   *  resource was opened via a subject, and Favorites → Resource when it
   *  was opened directly). */
  fromSubject?: string;
}

export function ResourceCard({ resource, showContext = true, via, fromSubject }: ResourceCardProps) {
  const { isFavorite, toggleFavorite, getBookmark, addBookmark, getDownload, startDownload, cancelDownload, getProgress } = useLibrary();
  const { toast } = useToast();

  const typeConfig = RESOURCE_TYPE_CONFIG[resource.type];
  const TypeIcon = typeConfig.icon;
  // Icon-only presentation: keep the assigned red/blue/yellow text color as the
  // Lucide stroke color, with no colored rectangular background behind the icon.
  const typeIconColor = typeConfig.badgeClass
    .split(" ")
    .filter((c) => !c.startsWith("bg-"))
    .join(" ");
  const { subjectName, semesterName } = useTaxonomy();
  const subjectDisplayName = subjectName(resource.subjectId);
  const semesterDisplayName = semesterName(resource.semesterId);
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
    toast("Bookmark saved");
  };

  const handleDownload = () => {
    if (download?.status === "completed" || download?.status === "downloading") {
      toast("Download already in progress or completed", "info");
      return;
    }
    startDownload(resource);
    toast(download ? "Retrying download" : "Download started");
  };
  const navState = buildResourceNavState(via, fromSubject);

  return (
    <Card interactive className="group relative flex h-full flex-col p-4 sm:p-5">
      {/* Stretched link — makes the whole card clickable */}
      <Link
        to={`/resources/${resource.id}`}
        state={navState}
        aria-label={`Open ${resource.title}`}
        className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
      {/* Taps anywhere open the detail page: content lets pointer events pass
          through to the stretched link, while real controls opt back in. */}
      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3 sm:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center">
            <TypeIcon className={cx("size-4.5", typeIconColor)} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-bold leading-snug text-foreground">
              {resource.title}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
              {typeConfig.label} · {resource.pageCount} pages · {formatFileSize(resource.fileSize)}
            </p>
            {showContext && (subjectDisplayName || semesterDisplayName) && (
              <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground/80">
                {[subjectDisplayName, semesterDisplayName].filter(Boolean).join(" · ")}
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
            className="pointer-events-auto relative"
          />
          <IconButton
            icon={Bookmark}
            label={bookmarked ? "Bookmarked" : "Bookmark first page"}
            size="sm"
            variant={bookmarked ? "bookmark" : "default"}
            filled={bookmarked}
            aria-pressed={bookmarked}
            onClick={handleBookmark}
            className="pointer-events-auto relative"
          />
        </div>
      </div>
      <Link
        to={`/resources/${resource.id}`}
        state={navState}
        aria-label={`Open ${resource.title}`}
        className="pointer-events-auto relative z-10 mt-2.5 flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-primary-muted text-xs font-bold text-primary transition-colors hover:bg-primary-muted-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:hidden"
      >
        Open
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </Link>

      {/* Desktop card body — unchanged, hidden on mobile. */}
      <div className="hidden sm:contents">
      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center sm:size-10">
            <TypeIcon className={cx("size-5", typeIconColor)} aria-hidden="true" />
          </div>
          <span className={cx("text-xs font-semibold", typeIconColor)}>
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
            className="pointer-events-auto relative"
          />
          <IconButton
            icon={Bookmark}
            label={bookmarked ? "Bookmarked" : "Bookmark first page"}
            size="sm"
            variant={bookmarked ? "bookmark" : "default"}
            filled={bookmarked}
            aria-pressed={bookmarked}
            onClick={handleBookmark}
            className="pointer-events-auto relative"
          />
        </div>
      </div>

      <div className="pointer-events-none mt-2.5 flex min-w-0 flex-1 flex-col sm:mt-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground group-hover:text-primary">
          {resource.title}
        </h3>
        {showContext && (subjectDisplayName || semesterDisplayName) && (
          <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
            {[subjectDisplayName, semesterDisplayName].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <div className="pointer-events-none mt-2 flex flex-wrap gap-1.5 sm:mt-3">
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
        <div className="pointer-events-none mt-2.5 sm:mt-3">
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

      <div className="pointer-events-none relative z-10 mt-3 flex items-center justify-between border-t border-border pt-3 text-xs font-medium text-muted-foreground sm:mt-4">
        <span>
          {resource.pageCount} pages · {formatFileSize(resource.fileSize)}
        </span>
        <div className="flex items-center gap-1">
          <Link
            to={`/reader/${resource.id}`}
            state={navState}
            className="pointer-events-auto relative inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary-muted px-2.5 text-xs font-bold text-primary transition-colors hover:bg-primary-muted-hover"
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
          ) : download?.status === "downloading" ? (
            <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary-muted px-2 text-xs font-bold text-primary">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              {download.progress}%
              <IconButton
                icon={X}
                label="Cancel download"
                size="sm"
                onClick={() => cancelDownload(resource.id)}
                className="pointer-events-auto relative"
              />
            </span>
          ) : (
            <IconButton
              icon={download?.status === "failed" || download?.status === "cancelled" ? RotateCcw : Download}
              label={download ? `Retry download of ${resource.title}` : `Download ${resource.title}`}
              size="sm"
              onClick={handleDownload}
              className="pointer-events-auto relative"
            />
          )}
        </div>
      </div>
      </div>
    </Card>
  );
}
