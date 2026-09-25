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
import { RESOURCE_TYPE_CONFIG } from "../lib/resourceType";
import {
  entryPointFromState,
  entryRootFor,
  showsSubjectInResourceTrail,
  subjectIdFromState,
  buildResourceNavState,
  adminEntryPointFromState,
  adminEntryRootFor,
  type ResourceNavState,
} from "../lib/resourceNavigation";
import { cx, formatFileSize, formatDate } from "../lib/utils";
import { useLibrary } from "../state/LibraryProvider";
import { useToast } from "../state/ToastProvider";
import { fetchResource, fetchSemester, fetchSubject, ApiError } from "../lib/contentApi";
import { adminDelete, adminDeleteFile, adminUpdate, adminUploadFile } from "../lib/adminApi";
import { useApiQuery } from "../hooks/useApiQuery";
import { ResourceDetailSkeleton } from "../components/skeletons/pages";

/**
 * THE canonical Resource Detail page — shared by the student panel
 * (/resources/:id) and the admin panel (/admin/resources/:id, opened from
 * Admin → Semesters, Resources, or Drafts). Admin context (detected from
 * the route) only adds a compact management strip: Edit / Hide-Unhide /
 * Delete. Everything else — header, details, quick info, reader — is
 * identical.
 */
export default function ResourceDetail() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname, state } = location;
  const { toast } = useToast();
  const { isFavorite, toggleFavorite, getBookmark, addBookmark, getDownload, startDownload, markOpened, getProgress, isContinueReading, toggleContinueReading } = useLibrary();
  const [editOpen, setEditOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const isAdmin = pathname.startsWith("/admin");
  const readerRoute = isAdmin ? "/admin/reader" : "/reader";
  /** Raw entry marker + subject trail, forwarded so detail → reader keeps
   *  the exact same breadcrumb (Favorites → Subject → Resource vs.
   *  Favorites → Resource). */
  const via = (state as ResourceNavState | null)?.via;
  /** Student navigation context: the breadcrumb mirrors the actual entry
   *  point (Resources / Favorites / Bookmarks / Downloads). Without state
   *  (direct URL, refresh) it falls back to the Semester trail. A Subject
   *  crumb is shown only when the user actually navigated through that
   *  subject (fromSubject matches) — never invented for direct opens. */
  const entry = entryPointFromState(state);
  const entryRoot = !isAdmin ? entryRootFor(entry) : undefined;
  const fromSubject = subjectIdFromState(state);
  /** Admin navigation context: Semesters / Resources / Drafts entry point.
   *  Stateless visits (direct URL, refresh) fall back to Resources. */
  const adminEntry = adminEntryPointFromState(state);
  const adminRoot = adminEntryRootFor(adminEntry);

  const { data, error, loading, retry } = useApiQuery(`resource-${resourceId ?? ""}`, async (signal) => {
    if (!resourceId) throw new Error("Missing resource.");
    const resource = await fetchResource(resourceId, signal);
    const [subject, semester] = await Promise.all([
      fetchSubject(resource.subjectId, signal).catch(() => null),
      fetchSemester(resource.semesterId, signal).catch(() => null),
    ]);
    return { resource, subject, semester };
  });
  const resource = data?.resource ?? null;
  const subject = data?.subject;
  const semester = data?.semester;

  if (loading) {
    return <ResourceDetailSkeleton adminStrip={isAdmin} />;
  }

  if (error || !resource) {
    return (
      <ErrorState
        title="Resource not found"
        message={error ?? "This resource does not exist or has been removed."}
        onRetry={error ? retry : () => navigate(isAdmin ? "/admin/resources" : "/resources")}
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

  const typeConfig = RESOURCE_TYPE_CONFIG[resource.type];
  const TypeIcon = typeConfig.icon;
  const favorite = isFavorite(resource.id);
  const bookmarked = Boolean(getBookmark(resource.id));
  const download = getDownload(resource.id);
  const progress = getProgress(resource.id);

  const openReader = () => {
    markOpened(resource.id);
    // Forward the full navigation context so detail → reader keeps the same
    // breadcrumb and nav highlight (student and admin alike). For students
    // this preserves Favorites/Bookmarks → Subject → Resource vs. the
    // direct Favorites/Bookmarks → Resource trail.
    if (isAdmin) {
      navigate(`${readerRoute}/${resource.id}`, { state: via ? { via } : undefined });
    } else {
      navigate(`${readerRoute}/${resource.id}`, {
        state: buildResourceNavState(entry, fromSubject),
      });
    }
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

  const inContinueReading = resource ? isContinueReading(resource.id) : false;
  const handleContinueReading = () => {
    if (!resource) return;
    toggleContinueReading(resource.id);
    toast(inContinueReading ? "Removed from Continue Reading" : "Added to Continue Reading");
  };

  const handleAdminHide = async (hidden: boolean) => {
    setBusyAction(true);
    try {
      await adminUpdate("resources", resource.id, { hidden });
      toast(hidden ? `"${resource.title}" hidden from students` : `"${resource.title}" visible to students again`);
      retry();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not update visibility.", "error");
    } finally {
      setBusyAction(false);
    }
  };

  const handleReplaceFile = async (file: File) => {
    setBusyAction(true);
    try {
      await adminUploadFile(resource.id, file, resource.pageCount || undefined);
      toast("PDF replaced");
      retry();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not replace file.", "error");
    } finally {
      setBusyAction(false);
    }
  };

  const handleRemoveFile = async () => {
    setBusyAction(true);
    try {
      await adminDeleteFile(resource.id);
      toast("PDF removed — resource is now a draft");
      retry();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not remove file.", "error");
    } finally {
      setBusyAction(false);
    }
  };

  const handleDelete = async () => {
    setBusyAction(true);
    try {
      await adminDelete("resources", resource.id);
      toast("Resource moved to trash");
      // Return one level back to the exact parent context the item was opened
      // from (same target as the Back button) — never to an unrelated page.
      const fallback = isAdmin
        ? adminRoot.to
        : (entryRoot ? entryRoot.to : "/resources");
      const idx = window.history.state?.idx;
      if (typeof idx === "number" && idx > 0) navigate(-1);
      else navigate(fallback, { replace: true });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not delete resource.", "error");
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div>
      <div className="mb-1 -ml-1 sm:-ml-1">
        <BackButton
          label="Back"
          fallbackTo={isAdmin ? adminRoot.to : (entryRoot ? entryRoot.to : "/resources")}
        />
      </div>
      <PageHeader
        title={resource.title}
        subtitle={resource.description}
        compactBreadcrumb={!isAdmin}
        breadcrumbs={
          isAdmin
            ? [
                { label: "Admin", to: "/admin" },
                { label: adminRoot.label, to: adminRoot.to },
                ...(adminEntry === "semesters" && semester ? [{ label: semester.name }] : []),
                { label: resource.title },
              ]
            : entryRoot
              ? showsSubjectInResourceTrail(entry, fromSubject, resource.subjectId) && subject
                ? [
                    { label: entryRoot.label, to: entryRoot.to },
                    { label: subject.name },
                    { label: resource.title },
                  ]
                : [
                    { label: entryRoot.label, to: entryRoot.to },
                    { label: resource.title },
                  ]
              : [
                { label: "Semester", to: "/semesters" },
                ...(semester ? [{ label: semester.name, to: `/semesters/${semester.id}` }] : []),
                ...(subject ? [{ label: subject.name, to: `/subjects/${subject.id}` }] : []),
                { label: resource.title },
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
              <Button
                size="sm"
                variant="primary"
                title="Edit resource details"
                className="transition-transform active:scale-95"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-4" aria-hidden="true" /> Edit
              </Button>
              {resource.hidden ? (
                <Button
                  size="sm"
                  variant="ghost"
                  title="Currently hidden from students — click to make visible"
                  aria-pressed={true}
                  className="bg-warning-muted text-warning transition-transform hover:bg-warning-muted hover:text-warning active:scale-95"
                  disabled={busyAction}
                  onClick={() => handleAdminHide(false)}
                >
                  <Eye className="size-4" aria-hidden="true" /> Show
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  title="Hide this resource from students (stays in Admin)"
                  aria-pressed={false}
                  className="border-warning/50 text-warning transition-transform hover:bg-warning-muted hover:text-warning active:scale-95"
                  disabled={busyAction}
                  onClick={() => handleAdminHide(true)}
                >
                  <EyeOff className="size-4" aria-hidden="true" /> Hide
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                title="Replace the PDF file"
                disabled={busyAction}
                onClick={() => document.getElementById("admin-replace-file")?.click()}
              >
                Replace file
              </Button>
              <Button
                size="sm"
                variant="ghost"
                title="Remove the PDF file (forces draft)"
                disabled={busyAction}
                onClick={() => { void handleRemoveFile(); }}
              >
                Remove file
              </Button>
              <input
                id="admin-replace-file"
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void handleReplaceFile(f);
                }}
              />
              <Button
                size="sm"
                variant="danger"
                title="Move this resource to trash"
                className="bg-[#FA003F]/15 text-[#FA003F] transition-transform hover:bg-[#FA003F] hover:text-white hover:opacity-100 active:scale-95"
                disabled={busyAction}
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
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-8">
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
              <span className="shrink-0 font-medium">File</span>
              <span className="min-w-0 truncate font-mono text-xs">{resource.fileName}</span>
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
          {!isAdmin && (
            <Button
              variant="outline"
              className="mt-2.5 w-full"
              onClick={handleContinueReading}
              aria-pressed={inContinueReading}
              aria-label={inContinueReading ? "Remove from Continue Reading" : "Add to Continue Reading"}
            >
              <Bookmark className="size-4" aria-hidden="true" />
              {inContinueReading ? "Remove from Continue Reading" : "Add to Continue Reading"}
            </Button>
          )}
        </Card>
      </div>

      {/* Admin edit — same editor modal as the Resources management table */}
      {isAdmin && (
        <>
          <ResourceEditorModal
            open={editOpen}
            editing={resource}
            onClose={() => setEditOpen(false)}
            onSaved={() => retry()}
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
