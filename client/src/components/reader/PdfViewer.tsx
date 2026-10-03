import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cx, clamp } from "../../lib/utils";
import { PdfCanvas, type PdfLoadState } from "./PdfCanvas";
import { MOBILE_PINCH_MAX_ZOOM, ZOOM_LEVELS, isMobileViewport, useReaderZoom } from "./useReaderZoom";
import { ReaderControlRegion, ReaderToolbarDesktop, ReaderToolbarMobile } from "./ReaderToolbar";
import { ReaderBreadcrumb } from "./ReaderBreadcrumb";
import { ReaderThumbnailSidebar } from "./ReaderThumbnailSidebar";
import { ReaderErrorState, ReaderLoadingState } from "./ReaderDocStates";

interface PdfViewerProps {
  resource: { id: string; title: string; pageCount: number };
  subtitle?: string;
  initialPage?: number;
  onPageChange?: (page: number, totalPages: number) => void;
  toolbarLeading?: ReactNode;
  onBookmark?: (currentPage: number) => void;
  bookmarked?: boolean;
  onDownload?: () => void;
  downloadActive?: boolean;
  breadcrumbs?: ReactNode;
  className?: string;
  fileUrl?: string | null;
  urlLoading?: boolean;
  urlError?: string | null;
  onRetryFile?: () => void;
  sourceLabel?: string | null;
}

export function PdfViewer({
  resource,
  subtitle,
  initialPage = 1,
  onPageChange,
  toolbarLeading,
  onBookmark,
  bookmarked = false,
  onDownload,
  downloadActive = false,
  breadcrumbs,
  className,
  fileUrl = null,
  urlLoading = false,
  urlError = null,
  onRetryFile,
  sourceLabel = null,
}: PdfViewerProps) {
  const [docPages, setDocPages] = useState<number | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const totalPages = Math.max(1, docPages ?? resource.pageCount);

  const [page, setPage] = useState(() => clamp(initialPage, 1, totalPages));
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Thumbnail sidebar: live document published by PdfCanvas (observe-only),
  // plus local collapse state (desktop only; mobile never renders it).
  const [sidebarDoc, setSidebarDoc] = useState<PDFDocumentProxy | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Single zoom source of truth (UI units); render mapping stays
  // platform-specific via zoomReference. See useReaderZoom.
  const {
    pdfZoom, zoomReference, zoomIn, zoomOut,
    handlePinchZoom, zoomLabel, canZoomIn, canZoomOut,
  } = useReaderZoom();
  const programmaticScrollRef = useRef(false);

  useEffect(() => {
    if (docPages !== null) setPage((p) => clamp(p, 1, docPages));
  }, [docPages]);

  const handlePdfState = useCallback((s: PdfLoadState) => {
    if (s.status === "ready") {
      setDocPages(s.totalPages ?? null);
      setDocError(null);
    } else if (s.status === "error") {
      setDocError(s.message ?? null);
    }
  }, []);

  const handlePageChange = useCallback((p: number, total: number) => {
    setPage(p);
    onPageChange?.(p, total);
  }, [onPageChange]);

  const goToPage = useCallback((next: number) => {
    const p = clamp(next, 1, totalPages);
    // Raise the programmatic flag only when navigation actually occurs: a
    // same-page request renders nothing, so the jump effect would never
    // consume a stale flag — and a stale flag would suppress zoom position
    // restore in PdfCanvas.
    setPage((prev) => {
      if (prev !== p) programmaticScrollRef.current = true;
      return p;
    });
    onPageChange?.(p, totalPages);
  }, [onPageChange, totalPages]);

  // Stable toolbar callbacks: the desktop + mobile toolbars share one
  // memoized prop bundle so no new closures are created per render.
  const handlePrevPage = useCallback(() => {
    goToPage(page - 1);
  }, [goToPage, page]);
  const handleNextPage = useCallback(() => {
    goToPage(page + 1);
  }, [goToPage, page]);
  const handleBookmarkPage = useCallback(() => {
    onBookmark?.(page);
  }, [onBookmark, page]);

  const handleFullscreen = useCallback(() => {
    try {
      if (document.fullscreenElement) {
        const pending = document.exitFullscreen();
        if (pending && typeof pending.catch === "function") pending.catch(() => {});
        setIsFullscreen(false);
      } else {
        const pending = document.documentElement.requestFullscreen();
        if (pending && typeof pending.catch === "function") pending.catch(() => {});
        setIsFullscreen(true);
      }
    } catch {
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toolbarCommon = useMemo(() => ({
    title: resource.title,
    subtitle,
    sourceLabel,
    page,
    totalPages,
    onPrevPage: handlePrevPage,
    onNextPage: handleNextPage,
    onDirectPage: goToPage,
    zoomLabel,
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    canZoomIn,
    canZoomOut,
    bookmarked,
    onBookmarkPage: onBookmark ? handleBookmarkPage : undefined,
    downloadActive,
    onDownloadPress: onDownload,
    isFullscreen,
    onToggleFullscreen: handleFullscreen,
  }), [
    resource.title, subtitle, sourceLabel, page, totalPages,
    handlePrevPage, handleNextPage, goToPage, zoomLabel, zoomIn, zoomOut,
    canZoomIn, canZoomOut, bookmarked,
    onBookmark, handleBookmarkPage, downloadActive, onDownload,
    isFullscreen, handleFullscreen,
  ]);

  const loadError = urlError ?? docError;

  return (
    <div
      aria-label="PDF viewer"
      className={cx(
        "reader-bar mt-0 flex flex-col overflow-hidden border-0 pt-0",
        // Exact viewport below the slim reader app header (h-12): window
        // never scrolls, only the PDF area does. mt-0 attaches the viewer
        // directly at the header's bottom edge with zero gap.
        "h-[calc(100vh-3rem)] supports-[height:100dvh]:h-[calc(100dvh-3rem)] bg-surface",
        className,
      )}
    >
      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* One fixed control region: breadcrumb + toolbar docked under
              the app header. Only the document below scrolls. */}
          <ReaderControlRegion>
            {breadcrumbs && (
              <ReaderBreadcrumb>{breadcrumbs}</ReaderBreadcrumb>
            )}

            <ReaderToolbarDesktop toolbarLeading={toolbarLeading} {...toolbarCommon} />
            <ReaderToolbarMobile toolbarLeading={toolbarLeading} {...toolbarCommon} />
          </ReaderControlRegion>

          <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
            {loadError ? (
              <ReaderErrorState message={loadError} onRetry={onRetryFile} />
            ) : urlLoading || !fileUrl ? (
              <ReaderLoadingState
                message={urlLoading ? "Requesting secure access…" : "Loading PDF…"}
              />
            ) : (
              // Desktop thumbnail rail + main document lane side by side.
              // The rail owns its own scroll; the lane keeps the existing
              // independent scroll. Sidebar width changes flow through the
              // existing ResizeObserver geometry with no manual math.
              <>
                {sidebarDoc && (
                  <ReaderThumbnailSidebar
                    key={fileUrl}
                    doc={sidebarDoc}
                    docKey={fileUrl}
                    totalPages={totalPages}
                    activePage={page}
                    open={sidebarOpen}
                    onToggle={() => setSidebarOpen((o) => !o)}
                    onSelectPage={goToPage}
                  />
                )}
                <div className="h-full min-w-0 flex-1 px-2 pb-2 pt-0">
                  <PdfCanvas
                    url={fileUrl}
                    page={page}
                    onStateChange={handlePdfState}
                    onPageChange={handlePageChange}
                    programmaticScrollRef={programmaticScrollRef}
                    zoom={pdfZoom * zoomReference}
                    onZoomChange={handlePinchZoom}
                    uiZoom={pdfZoom}
                    minZoom={ZOOM_LEVELS[0]}
                    maxZoom={isMobileViewport() ? MOBILE_PINCH_MAX_ZOOM : ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                    onDocument={setSidebarDoc}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
