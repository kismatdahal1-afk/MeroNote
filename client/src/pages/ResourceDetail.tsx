import { useParams, useNavigate } from "react-router-dom";
import {
  Eye, Download, Heart, Calendar, FileText, Tag, BookOpen, GraduationCap, Bookmark, Layers,
} from "lucide-react";
import { PageHeader, Card } from "../components/common/PageHeader";
import { ErrorState } from "../components/common/States";
import { Button } from "../components/common/Button";
import { IconButton } from "../components/common/IconButton";
import { BackButton } from "../components/common/BackButton";
import { Badge } from "../components/common/Badge";
import { getResourceById, getSubjectById, getSemesterById } from "../data/selectors";
import { RESOURCE_TYPE_CONFIG } from "../lib/resourceType";
import { cx, formatFileSize, formatDate } from "../lib/utils";
import { useLibrary } from "../state/LibraryProvider";
import { useToast } from "../state/ToastProvider";
import { useCmsSync } from "../components/common/CmsSync";

export default function ResourceDetail() {
  useCmsSync();
  const { resourceId } = useParams<{ resourceId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isFavorite, toggleFavorite, getBookmark, addBookmark, getDownload, startDownload, markOpened, getProgress } = useLibrary();

  const resource = getResourceById(resourceId);

  if (!resource) {
    return (
      <ErrorState
        title="Resource not found"
        message="This resource does not exist or has been removed."
        onRetry={() => navigate(-1)}
      />
    );
  }

  const subject = getSubjectById(resource.subjectId);
  const semester = getSemesterById(resource.semesterId);
  const typeConfig = RESOURCE_TYPE_CONFIG[resource.type];
  const TypeIcon = typeConfig.icon;
  const favorite = isFavorite(resource.id);
  const bookmarked = Boolean(getBookmark(resource.id));
  const download = getDownload(resource.id);
  const progress = getProgress(resource.id);

  const openReader = () => {
    markOpened(resource.id);
    navigate(`/reader/${resource.id}`);
  };

  const handleFavorite = () => {
    toggleFavorite(resource.id);
    toast(favorite ? "Removed from favorites" : "Added to favorites");
  };

  const handleBookmark = () => {
    if (bookmarked) {
      toast("Already bookmarked â€” manage from Bookmarks page", "info");
      return;
    }
    addBookmark(resource, progress?.lastPage ?? 1, "");
    toast("Bookmark saved (mock)");
  };

  const handleDownload = () => {
    if (download) {
      toast("Already downloaded or downloading", "info");
      return;
    }
    startDownload(resource);
    toast("Download started (mock)");
  };

  return (
    <div>
      <div className="mb-1 -ml-1 sm:-ml-1">
        <BackButton label="Back" />
      </div>
      <PageHeader
        title={resource.title}
        subtitle={resource.description}
        breadcrumbs={[
          { label: "Semesters", to: "/semesters" },
          ...(semester ? [{ label: semester.name, to: `/semesters/${semester.id}` }] : []),
          ...(subject ? [{ label: subject.name, to: `/subjects/${subject.id}` }] : []),
          { label: typeConfig.label },
        ]}
        actions={
          <>
            <IconButton
              icon={Heart}
              label={favorite ? "Remove from favorites" : "Add to favorites"}
              variant={favorite ? "favorite" : "default"}
              filled={favorite}
              aria-pressed={favorite}
              onClick={handleFavorite}
            />
            <IconButton
              icon={Bookmark}
              label={bookmarked ? "Bookmarked" : "Bookmark this resource"}
              variant={bookmarked ? "bookmark" : "default"}
              filled={bookmarked}
              aria-pressed={bookmarked}
              onClick={handleBookmark}
            />
            <Button variant="outline" onClick={handleDownload}>
              <Download className="size-4" aria-hidden="true" />
              {download?.status === "completed" ? "Downloaded" : "Download"}
            </Button>
            <Button onClick={openReader}>
              <Eye className="size-4" aria-hidden="true" />
              {progress ? "Continue reading" : "Read now"}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-base font-bold text-foreground">Details</h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Layers className="size-3.5" aria-hidden="true" />
                Type
              </dt>
              <dd className="mt-1">
                <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", typeConfig.badgeClass)}>
                  <TypeIcon className="size-3.5" aria-hidden="true" />
                  {typeConfig.label}
                </span>
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <BookOpen className="size-3.5" aria-hidden="true" /> Subject
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{subject?.name}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <GraduationCap className="size-3.5" aria-hidden="true" /> Semester
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{semester?.name}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <FileText className="size-3.5" aria-hidden="true" /> Pages
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{resource.pageCount}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <FileText className="size-3.5" aria-hidden="true" /> File size
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{formatFileSize(resource.fileSize)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Calendar className="size-3.5" aria-hidden="true" /> Added
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{formatDate(resource.uploadedAt)}</dd>
            </div>
          </dl>

          {resource.tags.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Tag className="size-3.5" aria-hidden="true" /> Tags
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {resource.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="h-fit p-5">
          <h3 className="text-sm font-bold text-foreground">Quick info</h3>
          <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-center justify-between gap-3">
              <span className="font-medium">File</span>
              <span className="truncate font-mono text-xs">{resource.fileName}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="font-medium">Updated</span>
              <span>{formatDate(resource.updatedAt)}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="font-medium">Status</span>
              {download?.status === "completed" ? (
                <Badge tone="success">Downloaded</Badge>
              ) : (
                <Badge tone="accent">Online</Badge>
              )}
            </li>
            {progress && (
              <li className="flex items-center justify-between gap-3">
                <span className="font-medium">Progress</span>
                <span>Page {progress.lastPage} / {resource.pageCount}</span>
              </li>
            )}
          </ul>
          <Button className="mt-5 w-full" onClick={openReader}>
            <Eye className="size-4" aria-hidden="true" />
            {progress ? "Continue reading" : "Read now"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
