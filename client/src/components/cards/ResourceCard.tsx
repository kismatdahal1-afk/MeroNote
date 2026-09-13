import { Link } from "react-router-dom";
import { Heart, Bookmark, Download, Eye, Check } from "lucide-react";
import type { Resource } from "../../types";
import { Card } from "../common/PageHeader";
import { RESOURCE_TYPE_CONFIG } from "../../lib/resourceType";
import { cx, formatFileSize } from "../../lib/utils";
import { getSubjectById, getSemesterById } from "../../data/selectors";
import { useLibrary } from "../../state/LibraryProvider";
import { useToast } from "../../state/ToastProvider";
import { IconButton } from "../common/IconButton";

interface ResourceCardProps {
  resource: Resource;
  /** show subject/semester line (used on dashboard/search results) */
  showContext?: boolean;
}

export function ResourceCard({ resource, showContext = true }: ResourceCardProps) {
  const { isFavorite, toggleFavorite, getBookmark, addBookmark, getDownload, startDownload } = useLibrary();
  const { toast } = useToast();

  const typeConfig = RESOURCE_TYPE_CONFIG[resource.type];
  const TypeIcon = typeConfig.icon;
  const subject = getSubjectById(resource.subjectId);
  const semester = getSemesterById(resource.semesterId);
  const favorite = isFavorite(resource.id);
  const bookmarked = Boolean(getBookmark(resource.id));
  const download = getDownload(resource.id);

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
    <Card interactive className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <Link
          to={`/resources/${resource.id}`}
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <div className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", typeConfig.badgeClass)}>
            <TypeIcon className="size-5" aria-hidden="true" />
          </div>
          <span className={cx("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", typeConfig.badgeClass)}>
            {typeConfig.label}
          </span>
        </Link>
        <div className="flex items-center gap-0.5">
          <IconButton
            icon={Heart}
            label={favorite ? "Remove from favorites" : "Add to favorites"}
            size="sm"
            variant={favorite ? "active" : "default"}
            aria-pressed={favorite}
            onClick={handleFavorite}
          />
          <IconButton
            icon={Bookmark}
            label={bookmarked ? "Bookmarked" : "Bookmark first page"}
            size="sm"
            variant={bookmarked ? "active" : "default"}
            aria-pressed={bookmarked}
            onClick={handleBookmark}
          />
        </div>
      </div>

      <Link
        to={`/resources/${resource.id}`}
        className="mt-3 flex min-w-0 flex-1 flex-col rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground hover:text-primary">
          {resource.title}
        </h3>
        {showContext && (subject || semester) && (
          <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
            {[subject?.name, semester?.name].filter(Boolean).join(" · ")}
          </p>
        )}
      </Link>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {resource.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs font-medium text-muted-foreground">
        <span>
          {resource.pageCount} pages · {formatFileSize(resource.fileSize)}
        </span>
        <div className="flex items-center gap-1">
          <Link
            to={`/reader/${resource.id}`}
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
    </Card>
  );
}
