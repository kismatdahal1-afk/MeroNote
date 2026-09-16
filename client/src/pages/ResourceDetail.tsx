import { useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import {
  Eye, EyeOff, Download, Heart, Calendar, FileText, Tag, BookOpen, GraduationCap, Bookmark, Layers,
  Pencil, Trash2,
} from "lucide-react";
import { PageHeader, Card } from "../components/common/PageHeader";
import { ErrorState } from "../components/common/States";
import { Button } from "../components/common/Button";
import { IconButton } from "../components/common/IconButton";
import { BackButton } from "../components/common/BackButton";
import { Badge } from "../components/common/Badge";
import { StatusBadge } from "../components/admin/StatusBadge";
import { ResourceEditorModal } from "../components/admin/ResourceEditorModal";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { getResourceById, getSubjectById, getSemesterById } from "../data/selectors";
import { RESOURCE_TYPE_CONFIG } from "../lib/resourceType";
import { cx, formatFileSize, formatDate } from "../lib/utils";
import { useLibrary } from "../state/LibraryProvider";
import { useToast } from "../state/ToastProvider";
import { setResourceHidden, softDelete, getDb } from "../state/cmsStore";
import { useCmsSync } from "../components/common/CmsSync";

/**
 * THE canonical Resource Detail page — shared by the student panel
 * (/resources/:id) and the admin panel (/admin/resources/:id, and topic
 * clicks from Admin → Topics). Admin context (detected from the route)
 * only adds a compact management strip: Edit / Hide-Unhide / Delete.
 * Everything else — header, details, quick info, reader — is identical.
 */
export default function ResourceDetail() {
  useCmsSync();
  const { resourceId } = useParams<{ resourceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname, state } = location;
  const { toast } = useToast();
  const { isFavorite, toggleFavorite, getBookmark, addBookmark, getDownload, startDownload, markOpened, getProgress } = useLibrary();
  const [editOpen, setEditOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  const isAdmin = pathname.startsWith("/admin");
  const readerRoute = isAdmin ? "/admin/reader" : "/reader";
  /** Admin navigation context: "topics" when opened from Admin → Topics,
   *  so the breadcrumb reflects where the admin came from. */
  const via = (state as { via?: string } | null)?.via;

  const resource = getResourceById(resourceId);

  if (!resource) {
    return (
      <ErrorState
        title="Resource not found"
        message="This resource does not exist or has been removed."
        onRetry={() => navigate(isAdmin ? "/admin/resources" : "/resources")}
      />
    );
  }

  if (!isAdmin && resource.hidden) {
    return (
      <ErrorState
        title="Resource hidden"
        message="This resource is not available to students."
        onRetry={() => navigate("/resources")}
      />
    );
  }

  const subject = getSubjectById(resource.subjectId);
  const semester = getSemesterById(resource.semesterId);
  /** Topic the resource is linked to (resource.topicId) — used for the
   *  Topics-context breadcrumb: Admin → Topics → Subject → Topic. */
  const topic = resource.topicId
    ? getDb().topics.find((t) => t.id === resource.topicId && !t.deletedAt)
    : undefined;
  const typeConfig = RESOURCE_TYPE_CONFIG[resource.type];
  const TypeIcon = typeConfig.icon;
  const favorite = isFavorite(resource.id);
  const bookmarked = Boolean(getBookmark(resource.id));
  const download = getDownload(resource.id);
  const progress = getProgress(resource.id);

  const openReader = () => {
    markOpened(resource.id);
    // Forward the navigation source (via:"topics") so the sidebar keeps
    // highlighting Topics while the reader is open.
    navigate(`${readerRoute}/${resource.id}`, { state: { via } });
  };

  const handleFavorite = () => {
    toggleFavorite(resource.id);
    toast(favorite ? "Removed from favorites" : "Added to favorites");
  };

  const handleBookmark = () => {
    if (bookmarked) {
      toast("Already bookmarked — manage from Bookmarks page", "info");
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

  const handleDelete = () => {
    softDelete("resource", resource.id);
    toast("Resource moved to trash");
    navigate("/admin/resources");
  };

  return (
    <div>
      <div className="mb-1 -ml-1 sm:-ml-1">
        <BackButton
          label="Back"
          fallbackTo={isAdmin ? (via === "topics" ? "/admin/semesters" : "/admin/resources") : "/resources"}
        />
      </div>
      <PageHeader
        title={resource.title}
        subtitle={resource.description}
        breadcrumbs={
          isAdmin
            ? via === "topics"
              ? [
                  { label: "Admin", to: "/admin" },
                  { label: "Semesters", to: "/admin/semesters" },
                  ...(semester ? [{ label: semester.name }] : []),
                  ...(subject ? [{ label: subject.name }] : []),
                  ...(topic ? [{ label: topic.title }] : []),
                ]
              : [
                  { label: "Admin", to: "/admin" },
                  { label: "Resources", to: "/admin/resources" },
                  ...(subject ? [{ label: subject.name }] : []),
                  ...(topic ? [{ label: topic.title }] : []),
                ]
            : [
                { label: "Semesters", to: "/semesters" },
                ...(semester ? [{ label: semester.name, to: `/semesters/${semester.id}` }] : []),
                ...(subject ? [{ label: subject.name, to: `/subjects/${subject.id}` }] : []),
                { label: typeConfig.label },
              ]
        }
        actions={
          isAdmin ? (
            <Button onClick={openReader}>
              <Eye className="size-4" aria-hidden="true" />
              {progress ? "Continue reading" : "Read now"}
            </Button>
          ) : (
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
          )
        }
      />

      {/* Admin-only management strip — Edit / Hide / Delete */}
      {isAdmin && (
        <Card className="mb-6 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <StatusBadge status={resource.status} />
              <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", typeConfig.badgeClass)}>
                <TypeIcon className="size-3.5" aria-hidden="true" />
                {typeConfig.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden="true" /> Edit
              </Button>
              {resource.hidden ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setResourceHidden(resource.id, false);
                    toast(`"${resource.title}" visible to students again`);
                  }}
                >
                  <Eye className="size-4" aria-hidden="true" /> Show
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setResourceHidden(resource.id, true);
                    toast(`"${resource.title}" hidden from students`);
                  }}
                >
                  <EyeOff className="size-4" aria-hidden="true" /> Hide
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-error hover:bg-error-muted hover:text-error"
                onClick={() => setPendingDelete(true)}
              >
                <Trash2 className="size-4" aria-hidden="true" /> Delete
              </Button>
            </div>
          </div>
        </Card>
      )}

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
              {isAdmin ? (
                <StatusBadge status={resource.status} />
              ) : download?.status === "completed" ? (
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

      {/* Admin edit — same editor modal as the Resources management table */}
      {isAdmin && (
        <>
          <ResourceEditorModal
            open={editOpen}
            editing={resource}
            onClose={() => setEditOpen(false)}
          />
          <ConfirmDialog
            open={pendingDelete}
            title="Delete resource"
            message={`"${resource.title}" will move to the trash. You can restore it from Trash, or delete it permanently there.`}
            confirmLabel="Delete"
            danger
            onCancel={() => setPendingDelete(false)}
            onConfirm={() => {
              setPendingDelete(false);
              handleDelete();
            }}
          />
        </>
      )}
    </div>
  );
}
