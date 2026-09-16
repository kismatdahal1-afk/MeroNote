import { useParams, useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { getResourceById, getSemesterById, getSubjectById } from "../../data/selectors";
import { useLibrary } from "../../state/LibraryProvider";
import { useToast } from "../../state/ToastProvider";
import { BackButton } from "../common/BackButton";
import { useCmsSync } from "../common/CmsSync";
import { PdfViewer } from "./PdfViewer";
import { getDb } from "../../state/cmsStore";

/**
 * Student PDF Reader page shell (Phase 2).
 * Delegates all viewer chrome/behavior to the shared PdfViewer so the
 * Phase 6 PDF.js integration drops in once for student + admin views.
 * When `admin` is set, back/details links stay inside the admin flow.
 * The admin navigation source (via:"topics") is forwarded so the sidebar
 * keeps highlighting the section the admin came from.
 */
export function ReaderShell({ admin = false }: { admin?: boolean }) {
  useCmsSync();
  const { resourceId } = useParams<{ resourceId: string }>();
  const { state } = useLocation();
  const via = (state as { via?: string } | null)?.via;
  const resource = getResourceById(resourceId);
  const { toast } = useToast();
  const { getProgress, setReadingProgress, addBookmark, getBookmark, getDownload, startDownload, markOpened } = useLibrary();
  const baseRoute = admin ? "/admin/resources" : "/resources";
  const detailState = admin && via ? { via } : undefined;

  if (!resource) {
    return (
      <div className="reader-bar flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">Resource not found</p>
          <div className="mt-3 flex justify-center">
            <BackButton
              fallbackTo={admin ? (via === "topics" ? "/admin/semesters" : "/admin/resources") : "/dashboard"}
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
  const topic = resource.topicId ? getDb().topics.find((t) => t.id === resource.topicId && !t.deletedAt) : undefined;
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
      resource={resource}
      subtitle={subject ? `${subject.name} · ${resource.pageCount} pages` : `${resource.pageCount} pages`}
      initialPage={progress?.lastPage}
      onPageChange={handlePageChange}
      breadcrumbs={
        admin ? (
          <>
            <Link to="/admin" className="rounded px-1 py-0.5 hover:text-primary">Admin</Link>
            <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
{via === "topics" ? (
                  <Link to="/admin/semesters" state={detailState} className="rounded px-1 py-0.5 hover:text-primary">
                    Semesters
                  </Link>
                ) : (
              <Link to="/admin/resources" className="rounded px-1 py-0.5 hover:text-primary">
                Resources
              </Link>
            )}
            {semester && via === "topics" && (
              <>
                <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
                <Link
                  to="/admin/semesters"
                  state={detailState}
                  className="max-w-[10rem] truncate rounded px-1 py-0.5 hover:text-primary"
                >
                  {semester.name}
                </Link>
              </>
            )}
            {subject && (
              <>
                <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
                <Link
                  to={via === "topics" ? "/admin/semesters" : "/admin/resources"}
                  state={detailState}
                  className="max-w-[12rem] truncate rounded px-1 py-0.5 hover:text-primary"
                >
                  {subject.name}
                </Link>
              </>
            )}
            {topic && (
              <>
                <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
                <Link
                  to={`${baseRoute}/${resource.id}`}
                  state={detailState}
                  className="max-w-[12rem] truncate rounded px-1 py-0.5 hover:text-primary"
                >
                  {topic.title}
                </Link>
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
            <span aria-current="page" className="min-w-0 whitespace-normal rounded px-1 py-0.5 font-semibold text-foreground">
              {resource.title}
            </span>
          </>
        )
      }
      toolbarLeading={
        <BackButton
          iconOnly
          fallbackTo={`${baseRoute}/${resource.id}`}
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
