import { useParams, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { getResourceById, getSemesterById, getSubjectById } from "../../data/selectors";
import {
  entryPointFromState,
  entryRootFor,
  showsSubjectInResourceTrail,
  subjectIdFromState,
  buildResourceNavState,
  adminEntryPointFromState,
  adminEntryRootFor,
  type ResourceNavState,
} from "../../lib/resourceNavigation";
import { useLibrary } from "../../state/LibraryProvider";
import { useToast } from "../../state/ToastProvider";
import { fetchResourceFileUrl, FileApiError } from "../../lib/resourceFileApi";
import { BackButton } from "../common/BackButton";
import { useCmsSync } from "../common/CmsSync";
import { PdfViewer } from "./PdfViewer";

/**
 * Student PDF Reader page shell (Phase 2).
 * Delegates all viewer chrome/behavior to the shared PdfViewer so the
 * Phase 6 PDF.js integration drops in once for student + admin views.
 * When `admin` is set, back/details links stay inside the admin flow.
 * The admin navigation source (entry-point state) is forwarded so the
 * sidebar keeps highlighting the section the admin came from.
 */
export function ReaderShell({ admin = false }: { admin?: boolean }) {
  useCmsSync();
  const { resourceId } = useParams<{ resourceId: string }>();
  const { state } = useLocation();
  const via = (state as ResourceNavState | null)?.via;
  /** Student navigation context: the breadcrumb mirrors the actual entry
   *  point (Resources / Favorites / Bookmarks / Downloads). A Subject crumb
   *  appears only when the user actually navigated through that subject
   *  (fromSubject matches) — direct Favorites/Bookmarks → Resource opens
   *  never invent one. Without state (direct URL, refresh) it falls back
   *  to the Semester trail. */
  const entry = entryPointFromState(state);
  const entryRoot = !admin ? entryRootFor(entry) : undefined;
  const fromSubject = subjectIdFromState(state);
  /** Link back to the detail page preserves the full trail so
   *  reader → detail keeps the same breadcrumb. */
  const detailNavState = !admin
    ? buildResourceNavState(entry, fromSubject)
    : undefined;
  /** Admin navigation context: Semesters / Resources / Drafts entry point.
   *  Stateless visits (direct URL, refresh) fall back to Resources. */
  const adminEntry = adminEntryPointFromState(state);
  const adminRoot = adminEntryRootFor(adminEntry);
  const resource = getResourceById(resourceId);
  const { toast } = useToast();
  const { getProgress, setReadingProgress, addBookmark, getBookmark, getDownload, startDownload, markOpened } = useLibrary();
  const baseRoute = admin ? "/admin/resources" : "/resources";
  const detailState = admin && via ? { via } : undefined;

  // Phase 6 secure file access: short-lived presigned URL per resource.
  // The binary is streamed by PDF.js — never stored in app state.
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const openResourceId = resource?.id;

  useEffect(() => {
    if (!openResourceId) return;
    let cancelled = false;
    setFileUrl(null);
    setUrlError(null);
    setUrlLoading(true);
    fetchResourceFileUrl(openResourceId).then(
      ({ url }) => {
        if (cancelled) return;
        setFileUrl(url);
        setUrlLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setUrlError(err instanceof FileApiError ? err.message : "Couldn't open this file.");
        setUrlLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [openResourceId, retryNonce]);

  if (!resource) {
    return (
      <div className="reader-bar flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">Resource not found</p>
          <div className="mt-3 flex justify-center">
            <BackButton
              fallbackTo={admin ? adminRoot.to : "/dashboard"}
              label="Go back"
            />
          </div>
        </div>
      </div>
    );
  }

  if (!admin && resource.hidden) {
    return (
      <div className="reader-bar flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">Resource hidden</p>
          <p className="mt-2 text-sm text-muted-foreground">This resource is not available to students.</p>
          <div className="mt-3 flex justify-center">
            <BackButton fallbackTo="/dashboard" label="Go back" />
          </div>
        </div>
      </div>
    );
  }

  const subject = getSubjectById(resource.subjectId);
  const semester = getSemesterById(resource.semesterId);
  const bookmarked = Boolean(getBookmark(resource.id));
  const download = getDownload(resource.id);
  const totalPages = resource.pageCount;
  const progress = getProgress(resource.id);

  const handlePageChange = (page: number) => {
    setReadingProgress(resource.id, page, totalPages);
    markOpened(resource.id);
  };

  const handleBookmark = (page: number) => {
    if (bookmarked) {
      toast("Already bookmarked — manage from Bookmarks page", "info");
      return;
    }
    addBookmark(resource, page, "");
    toast(`Bookmarked page ${page} (mock)`);
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
    <PdfViewer
      // Fresh viewer state (page, zoom, PDF.js doc) per document.
      key={resource.id}
      resource={resource}
      subtitle={subject ? `${subject.name} · ${resource.pageCount} pages` : `${resource.pageCount} pages`}
      initialPage={progress?.lastPage}
      onPageChange={handlePageChange}
      fileUrl={fileUrl}
      urlLoading={urlLoading}
      urlError={urlError}
      onRetryFile={() => setRetryNonce((n) => n + 1)}      breadcrumbs={
        admin ? (
          <>
            <Link to="/admin" className="rounded px-1 py-0.5 hover:text-primary">Admin</Link>
            <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
            {adminEntry === "drafts" ? (
              <Link to="/admin/drafts" className="rounded px-1 py-0.5 hover:text-primary">Draft</Link>
            ) : adminEntry === "semesters" ? (
              <Link to="/admin/semesters" state={detailState} className="rounded px-1 py-0.5 hover:text-primary">
                Semesters
              </Link>
            ) : (
              <Link to="/admin/resources" className="rounded px-1 py-0.5 hover:text-primary">
                Resources
              </Link>
            )}
            {adminEntry === "semesters" && semester && (
              <>
                <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
                <span className="max-w-[10rem] truncate rounded px-1 py-0.5">
                  {semester.name}
                </span>
              </>
            )}
            <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
            <Link
              to={`${baseRoute}/${resource.id}`}
              state={detailState}
              className="max-w-[16rem] truncate rounded px-1 py-0.5 font-semibold text-foreground hover:text-primary"
            >
              {resource.title}
            </Link>
            <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
            <span aria-current="page" className="font-semibold text-foreground/80">PDF</span>
          </>
        ) : entryRoot ? (
          <>
            <Link to={entryRoot.to} className="shrink-0 rounded px-1 py-0.5 hover:text-primary">{entryRoot.label}</Link>
            {showsSubjectInResourceTrail(entry, fromSubject, resource.subjectId) && subject && (
              <span className="inline-flex min-w-0 items-center gap-0.5">
                <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
                <span className="whitespace-normal rounded px-1 py-0.5">
                  {subject.name}
                </span>
              </span>
            )}
            <span className="inline-flex min-w-0 items-center gap-0.5">
              <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
              <Link
                to={`${baseRoute}/${resource.id}`}
                state={detailNavState}
                className="whitespace-normal rounded px-1 py-0.5 hover:text-primary"
              >
                {resource.title}
              </Link>
            </span>
            <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
            <span aria-current="page" className="font-semibold text-foreground/80">PDF</span>
          </>
        ) : (
          <>
            <Link to="/semesters" className="shrink-0 rounded px-1 py-0.5 hover:text-primary">Semester</Link>
            {semester && (
              <span className="inline-flex min-w-0 items-center gap-0.5">
                <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
                <Link
                  to={`/semesters/${semester.id}`}
                  className="rounded px-1 py-0.5 hover:text-primary"
                >
                  {semester.name}
                </Link>
              </span>
            )}
            {subject && (
              <span className="inline-flex min-w-0 items-center gap-0.5">
                <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
                <Link
                  to={`/subjects/${subject.id}`}
                  className="whitespace-normal rounded px-1 py-0.5 hover:text-primary"
                >
                  {subject.name}
                </Link>
              </span>
            )}
            <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
            <Link
              to={`${baseRoute}/${resource.id}`}
              className="min-w-0 whitespace-normal rounded px-1 py-0.5 hover:text-primary"
            >
              {resource.title}
            </Link>
            <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
            <span aria-current="page" className="font-semibold text-foreground/80">PDF</span>
          </>
        )
      }
      toolbarLeading={
        <BackButton
          iconOnly
          fallbackTo={entryRoot ? entryRoot.to : `${baseRoute}/${resource.id}`}
          label="Back to resource"
          className="text-foreground/75 hover:bg-surface-hover hover:text-foreground"
        />
      }
       onBookmark={handleBookmark}
       bookmarked={bookmarked}
       onDownload={handleDownload}
       downloadActive={download?.status === "completed"}
     />
  );
}
