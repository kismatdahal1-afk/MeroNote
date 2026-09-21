import { useParams, useLocation } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { fetchResource, fetchSemester, fetchSubject } from "../../lib/contentApi";
import { useApiQuery } from "../../hooks/useApiQuery";
import { ReaderSkeleton } from "../skeletons/pages";
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
import { useUser } from "../../state/UserProvider";
import { getServerProgress, putServerProgress } from "../../lib/studyApi";
import { fetchResourceFileUrl, FileApiError } from "../../lib/resourceFileApi";
import { resolveLocalFileUrl, revokeLocalFileUrl } from "../../lib/downloadManager";
import { getTempPdf, putTempPdf } from "../../lib/tempPdfCache";
import { decideReadingSource, readingSourceLabel, type ReadingSource } from "../../lib/cachePolicy";
import { BackButton } from "../common/BackButton";
import { PdfViewer } from "./PdfViewer";

export function ReaderShell({ admin = false }: { admin?: boolean }) {
  const { resourceId } = useParams<{ resourceId: string }>();
  const { state } = useLocation();
  const via = (state as ResourceNavState | null)?.via;
  const entry = entryPointFromState(state);
  const entryRoot = !admin ? entryRootFor(entry) : undefined;
  const fromSubject = subjectIdFromState(state);
  const detailNavState = !admin
    ? buildResourceNavState(entry, fromSubject)
    : undefined;
  const adminEntry = adminEntryPointFromState(state);
  const adminRoot = adminEntryRootFor(adminEntry);

  const { data: meta, error: metaError, loading: metaLoading } = useApiQuery(
    `reader-meta-${resourceId ?? ""}`,
    async (signal) => {
      if (!resourceId || resourceId === "null" || resourceId === "undefined") throw new Error("Invalid resource id.");
      const resource = await fetchResource(resourceId, signal);
      const [subject, semester] = await Promise.all([
        fetchSubject(resource.subjectId, signal).catch(() => null),
        fetchSemester(resource.semesterId, signal).catch(() => null),
      ]);
      return { resource, subject, semester };
    },
  );

  const resource = meta?.resource ?? null;
  const { toast } = useToast();
  const { getProgress, setReadingProgress, addBookmark, getBookmark, getDownload, startDownload, markOpened } = useLibrary();
  const baseRoute = admin ? "/admin/resources" : "/resources";
  const detailState = admin && via ? { via } : undefined;

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [source, setSource] = useState<ReadingSource | null>(null);
  const openResourceId = resource?.id;
  const localObjectUrl = useRef<string | null>(null);
  const metaResource = meta?.resource ?? null;

  useEffect(() => {
    if (!openResourceId || !metaResource) return;
    const rid = openResourceId;
    let cancelled = false;
    setFileUrl(null);
    setUrlError(null);
    setUrlLoading(true);
    setSource(null);

    const showObjectUrl = (url: string, src: ReadingSource) => {
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      localObjectUrl.current = url;
      setFileUrl(url);
      setSource(src);
      setUrlLoading(false);
    };

    const fail = (message: string) => {
      if (!cancelled) {
        setUrlError(message);
        setUrlLoading(false);
      }
    };

    const openRemoteStream = () => {
      fetchResourceFileUrl(rid).then(
        ({ url }) => {
          if (cancelled) return;
          setFileUrl(url);
          setSource(null);
          setUrlLoading(false);
        },
        (err: unknown) => {
          if (cancelled) return;
          fail(err instanceof FileApiError ? err.message : "Couldn't open this file.");
        },
      );
    };

    (async () => {
      try {
        const local = await resolveLocalFileUrl(rid);
        if (cancelled) {
          if (local) revokeLocalFileUrl(local);
          return;
        }
        if (local) {
          showObjectUrl(local, "download");
          return;
        }
      } catch {}

      try {
        const temp = await getTempPdf(rid);
        if (cancelled) return;
        if (temp) {
          showObjectUrl(URL.createObjectURL(temp), "cache");
          return;
        }
      } catch {}

      const decision = decideReadingSource({ hasPermanentDownload: false, hasTempCache: false, fileSize: metaResource.fileSize });
      if (decision === "network-fetch") {
        try {
          const { url } = await fetchResourceFileUrl(rid);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const res = await fetch(url, { credentials: "omit", signal: controller.signal });
          clearTimeout(timeout);
          if (!res.ok) throw new Error(`PDF fetch failed with status ${res.status}.`);
          const buffer = await res.arrayBuffer();
          const head = new TextDecoder().decode(new Uint8Array(buffer).slice(0, 5));
          if (head !== "%PDF-") {
            if (!cancelled) fail("This file couldn't be opened as a PDF.");
            return;
          }
          const blob = new Blob([buffer], { type: "application/pdf" });
          await putTempPdf(rid, blob).catch(() => {});
          if (!cancelled) showObjectUrl(URL.createObjectURL(blob), "network-fetch");
          return;
        } catch (err) {
          if (cancelled) return;
          if (err instanceof DOMException && err.name === "AbortError") {
            fail("The file request timed out. Check your connection and try again.");
            return;
          }
          if (err instanceof FileApiError && !navigator.onLine) {
            fail(err.message);
            return;
          }
          openRemoteStream();
          return;
        }
      }
      if (decision === "network-stream") {
        openRemoteStream();
        return;
      }
      fail("You're offline and there's no saved copy of this file.");
    })();

    return () => {
      cancelled = true;
      if (localObjectUrl.current) {
        URL.revokeObjectURL(localObjectUrl.current);
        localObjectUrl.current = null;
      }
    };
  }, [openResourceId, retryNonce, metaResource]);

  const { status: authStatus } = useUser();
  const progressTimer = useRef<number | null>(null);
  const pendingPage = useRef<number | null>(null);
  const touchedLocally = useRef(false);

  const persistProgress = (page: number) => {
    if (authStatus !== "authed" || !openResourceId) return;
    touchedLocally.current = true;
    pendingPage.current = page;
    if (progressTimer.current !== null) window.clearTimeout(progressTimer.current);
    progressTimer.current = window.setTimeout(() => {
      progressTimer.current = null;
      const next = pendingPage.current;
      pendingPage.current = null;
      if (next !== null && openResourceId) void putServerProgress(openResourceId, next).catch(() => {});
    }, 1500);
  };

  useEffect(() => {
    if (authStatus !== "authed" || !openResourceId) return;
    const rid = openResourceId;
    touchedLocally.current = false;
    let cancelled = false;
    void getServerProgress(rid).then((server) => {
      if (cancelled || !server || touchedLocally.current || getProgress(rid)) return;
      const total = metaResource?.pageCount ?? server.lastPage;
      setReadingProgress(rid, Math.min(server.lastPage, total), total);
    });
    return () => {
      cancelled = true;
      if (progressTimer.current !== null) {
        window.clearTimeout(progressTimer.current);
        progressTimer.current = null;
      }
      const next = pendingPage.current;
      pendingPage.current = null;
      if (next !== null) void putServerProgress(rid, next).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openResourceId, authStatus, metaResource]);

  const totalPages = resource?.pageCount ?? 0;
  const progress = resource ? getProgress(resource.id) : null;

  const handlePageChange = useCallback((page: number) => {
    if (!resource) return;
    setReadingProgress(resource.id, page, totalPages);
    markOpened(resource.id);
    persistProgress(page);
  }, [resource?.id ?? "", totalPages, setReadingProgress, markOpened, persistProgress]);

  if (metaLoading) {
    return (
      <div className="reader-bar flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">Loading resource…</p>
          <ReaderSkeleton />
          <div className="mt-3 flex justify-center">
            <BackButton fallbackTo={admin ? adminRoot.to : "/dashboard"} label="Go back" />
          </div>
        </div>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="reader-bar flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center">
          {metaError ? (
            <>
              <p className="text-lg font-bold text-foreground">Couldn't load this resource</p>
              <p className="mt-2 text-sm text-muted-foreground">{metaError}</p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-foreground">Resource not found</p>
              <ReaderSkeleton />
            </>
          )}
          <div className="mt-3 flex justify-center">
            <BackButton fallbackTo={admin ? adminRoot.to : "/dashboard"} label="Go back" />
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

  const subject = meta?.subject ?? null;
  const semester = meta?.semester ?? null;
  const bookmarked = Boolean(getBookmark(resource.id));
  const download = getDownload(resource.id);

  const handleBookmark = (page: number) => {
    if (bookmarked) {
      toast("Already bookmarked — manage from Bookmarks page", "info");
      return;
    }
    addBookmark(resource, page, "");
    toast(`Bookmarked page ${page}`);
  };

  const handleDownload = () => {
    if (download?.status === "completed" || download?.status === "downloading") {
      toast("Download already in progress or completed", "info");
      return;
    }
    startDownload(resource);
    toast(download ? "Retrying download" : "Download started");
  };

  return (
    <PdfViewer
      key={resource.id}
      resource={resource}
      subtitle={subject ? `${subject.name} · ${resource.pageCount} pages` : `${resource.pageCount} pages`}
      initialPage={progress?.lastPage}
      onPageChange={handlePageChange}
      fileUrl={fileUrl}
      urlLoading={urlLoading}
      urlError={urlError}
      sourceLabel={source ? readingSourceLabel(source) : null}
      onRetryFile={() => setRetryNonce((n) => n + 1)}
      breadcrumbs={
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
