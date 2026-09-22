import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import {
  Bookmark, ChevronLeft, ChevronRight, Download, FileWarning, Loader2, Search,
  Maximize2, Minus, Plus,
} from "lucide-react";
import { IconButton } from "../common/IconButton";
import { useToast } from "../../state/ToastProvider";
import { cx, clamp } from "../../lib/utils";
import { PdfCanvas, type PdfLoadState } from "./PdfCanvas";

// PDF-only zoom steps, shared by the [-] % [+] buttons and the mobile
// two-finger pinch gesture (single pdfZoom source of truth). Applied to the
// PDF page render width inside PdfCanvas — the header, counter, and shell
// are never scaled. Desktop default stays 100% (unchanged appearance);
// mobile opens zoomed out for a comfortably framed fit-width view.
const ZOOM_LEVELS = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5];
const DEFAULT_ZOOM_INDEX = 4; // 100%
// Mobile-only render reference: on a mobile viewport the 100% UI zoom state
// renders at the existing 40% scale (100% UI -> 0.4 render). Desktop uses 1.
const MOBILE_RENDER_REFERENCE = 0.4;

function isMobileViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 767px)").matches
  );
}

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
  variant?: "page" | "embedded";
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
  variant = "page",
  breadcrumbs,
  className,
  fileUrl = null,
  urlLoading = false,
  urlError = null,
  onRetryFile,
  sourceLabel = null,
}: PdfViewerProps) {
  const { toast } = useToast();
  const [docPages, setDocPages] = useState<number | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const totalPages = Math.max(1, docPages ?? resource.pageCount);

  const [page, setPage] = useState(() => clamp(initialPage, 1, totalPages));
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(ZOOM_LEVELS[DEFAULT_ZOOM_INDEX]);
  // UI zoom state stays platform-independent (100% = 1.0 everywhere); only
  // the render mapping below is mobile-adjusted. Captured once at mount.
  const [zoomReference] = useState(() =>
    isMobileViewport() ? MOBILE_RENDER_REFERENCE : 1,
  );
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
    programmaticScrollRef.current = true;
    setPage(p);
    onPageChange?.(p, totalPages);
  }, [onPageChange, totalPages]);

  const stepZoom = useCallback((dir: 1 | -1) => {
    setPdfZoom((z) => {
      let best = 0;
      for (let i = 0; i < ZOOM_LEVELS.length; i++) {
        if (Math.abs(ZOOM_LEVELS[i] - z) < Math.abs(ZOOM_LEVELS[best] - z)) best = i;
      }
      return ZOOM_LEVELS[clamp(best + dir, 0, ZOOM_LEVELS.length - 1)];
    });
  }, []);
  const zoomIn = useCallback(() => stepZoom(1), [stepZoom]);
  const zoomOut = useCallback(() => stepZoom(-1), [stepZoom]);
  // Pinch delivers continuous values; snap them to the supported steps so
  // every gesture commit settles exactly like a button press (one render,
  // no teardown churn, no canvas flash). Unchanged values bail out of
  // rendering entirely. Button steps pass through untouched — exact steps
  // snap to themselves — so there is still exactly one zoom source of truth.
  const handlePinchZoom = useCallback((z: number) => {
    setPdfZoom(() => {
      let best = 0;
      for (let i = 0; i < ZOOM_LEVELS.length; i++) {
        if (Math.abs(ZOOM_LEVELS[i] - z) < Math.abs(ZOOM_LEVELS[best] - z)) best = i;
      }
      return ZOOM_LEVELS[best];
    });
  }, []);
  const zoomLabel = `${Math.round(pdfZoom * 100)}%`;

  const handleFullscreen = () => {
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
  };

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const isPage = variant === "page";

  return (
    <div
      aria-label="PDF viewer"
      className={cx(
        "reader-bar flex flex-col overflow-hidden",
        isPage
          ? "h-screen supports-[height:100dvh]:h-dvh bg-background"
          : "card-glow overflow-hidden rounded-xl border border-border bg-surface shadow-card",
        className,
      )}
    >
      <main
        className={cx(
          "flex-1 min-h-0 overflow-hidden",
          isPage ? "pb-0" : "",
        )}
      >
        <div className="flex flex-col h-full">
          <header
            className={cx(
              "sticky top-0 z-30 flex-shrink-0 flex flex-col",
              isPage
                ? "bg-surface/95 backdrop-blur-md"
                : "bg-surface-muted/50",
            )}
          >
            {breadcrumbs && isPage && (
              <div className="flex min-h-[1.5rem] flex-wrap items-center gap-0.5 border-b border-border bg-background/95 px-3 py-0.5 text-[10px] md:text-xs font-medium text-muted-foreground/80 backdrop-blur-sm whitespace-nowrap overflow-hidden">
                {breadcrumbs}
              </div>
            )}

            <div
              className={cx(
                "hidden items-center gap-2 border-b border-border px-3 lg:px-4",
                isPage ? "h-14" : "h-12",
                "md:flex",
              )}
            >
              {toolbarLeading}
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-sm font-bold text-foreground">{resource.title}</h1>
                {subtitle && <p className="truncate text-xs font-medium text-muted-foreground">{subtitle}</p>}
                {sourceLabel && (
                  <p className="mt-0.5 truncate text-[11px] font-bold text-success">{sourceLabel}</p>
                )}
              </div>

              <div className="hidden items-center gap-1 md:flex">
                <IconButton icon={ChevronLeft} label="Previous page" variant="bar" onClick={() => goToPage(page - 1)} disabled={page <= 1} />
                <div className="flex h-9 items-center gap-1 rounded-lg border border-border-strong bg-surface-muted px-2">
                  <input
                    type="number"
                    value={page}
                    min={1}
                    max={totalPages}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (v >= 1 && v <= totalPages) goToPage(v);
                    }}
                    aria-label="Page number"
                    className="w-12 bg-transparent text-center text-sm font-semibold text-foreground focus:outline-none"
                  />
                  <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">/ {totalPages}</span>
                </div>
                <IconButton icon={ChevronRight} label="Next page" variant="bar" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} />
              </div>

              <div className="flex h-9 items-center gap-0.5 rounded-lg border border-border-strong bg-surface-muted px-1" role="group" aria-label="PDF zoom">
                <IconButton icon={Minus} label="Zoom out PDF" variant="bar" size="sm" onClick={zoomOut} disabled={pdfZoom <= ZOOM_LEVELS[0]} />
                <span className="min-w-10 text-center text-xs font-bold tabular-nums text-foreground" aria-live="polite">{zoomLabel}</span>
                <IconButton icon={Plus} label="Zoom in PDF" variant="bar" size="sm" onClick={zoomIn} disabled={pdfZoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]} />
              </div>

              <IconButton
                icon={Search}
                label={searchOpen ? "Close search" : "Search in document"}
                variant={searchOpen ? "active" : "bar"}
                onClick={() => setSearchOpen((s) => !s)}
              />

              {onBookmark && (
                <IconButton
                  icon={Bookmark}
                  label="Bookmark current page"
                  variant={bookmarked ? "bookmark" : "bar"}
                  filled={bookmarked}
                  onClick={() => onBookmark?.(page)}
                />
              )}
              {onDownload && (
                <IconButton
                  icon={Download}
                  label="Download resource"
                  variant={downloadActive ? "active" : "bar"}
                  onClick={onDownload}
                />
              )}
              <IconButton
                icon={Maximize2}
                label={isFullscreen ? "Exit fullscreen" : "Toggle fullscreen"}
                variant={isFullscreen ? 'active' : 'bar'}
                onClick={handleFullscreen}
              />
            </div>

            <div className="flex md:hidden items-center gap-2 border-b border-border px-3 py-1">
              {toolbarLeading}
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-sm font-bold text-foreground">{resource.title}</h1>
                {subtitle && <p className="truncate text-[11px] font-medium text-muted-foreground">{subtitle}</p>}
                {sourceLabel && (
                  <p className="truncate text-[10px] font-bold text-success">{sourceLabel}</p>
                )}
              </div>
            </div>

            <div className="flex md:hidden items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
              <div className="flex items-center gap-1 rounded-md bg-surface-muted px-1.5">
                <IconButton icon={ChevronLeft} label="Previous page" variant="bar" size="sm" onClick={() => goToPage(page - 1)} disabled={page <= 1} />
                <div className="flex h-7 items-center gap-0.5">
                  <span className="text-xs font-bold text-foreground">{page}</span>
                  <span className="text-[10px] font-medium text-muted-foreground">/ {totalPages}</span>
                </div>
                <IconButton icon={ChevronRight} label="Next page" variant="bar" size="sm" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} />
              </div>
              <div className="flex items-center gap-0.5 rounded-md bg-surface-muted px-1" role="group" aria-label="PDF zoom">
                <IconButton icon={Minus} label="Zoom out PDF" variant="bar" size="sm" onClick={zoomOut} disabled={pdfZoom <= ZOOM_LEVELS[0]} />
                <span className="min-w-10 text-center text-[11px] font-bold tabular-nums text-foreground" aria-live="polite">{zoomLabel}</span>
                <IconButton icon={Plus} label="Zoom in PDF" variant="bar" size="sm" onClick={zoomIn} disabled={pdfZoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]} />
              </div>
              <IconButton
                icon={Search}
                label={searchOpen ? "Close search" : "Search in document"}
                variant={searchOpen ? "active" : "bar"}
                size="sm"
                onClick={() => setSearchOpen((s) => !s)}
              />
              {onBookmark && (
                <IconButton
                  icon={Bookmark}
                  label="Bookmark"
                  variant={bookmarked ? "bookmark" : "bar"}
                  filled={bookmarked}
                  size="sm"
                  onClick={() => onBookmark?.(page)}
                />
              )}
              {onDownload && (
                <IconButton
                  icon={Download}
                  label="Download"
                  variant={downloadActive ? "active" : "bar"}
                  size="sm"
                  onClick={onDownload}
                />
              )}
              <IconButton
                icon={Maximize2}
                label={isFullscreen ? "Exit fullscreen" : "Toggle fullscreen"}
                variant={isFullscreen ? 'active' : 'bar'}
                size="sm"
                onClick={handleFullscreen}
              />
            </div>

            {searchOpen && (
              <div
                className="border-b border-border bg-surface/95 px-3 py-2 backdrop-blur-sm"
              >
                <form
                  className="mx-auto flex max-w-xl items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    toast(searchQuery ? `Search: "${searchQuery}" (available in Phase 6)` : "Enter a search term", "info");
                  }}
                >
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search in document..."
                    aria-label="Search in document"
                    className="h-9 w-full rounded-lg border border-border-strong bg-surface-muted px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                      className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Close search"
                    >
                      <Search className="size-4" />
                    </button>
                  )}
                </form>
              </div>
            )}
          </header>

          <div className="flex-1 min-h-0 overflow-hidden bg-background">
            {urlError || docError ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-2 p-8 text-center">
                <FileWarning className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-bold text-foreground">Couldn't open this PDF</p>
                <p className="max-w-sm text-xs font-medium text-muted-foreground">{urlError ?? docError}</p>
                {onRetryFile && (
                  <button
                    type="button"
                    onClick={onRetryFile}
                    className="mt-1 rounded-lg bg-primary-muted px-3.5 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary-muted-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Try again
                  </button>
                )}
              </div>
            ) : urlLoading || !fileUrl ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8" role="status" aria-label="Loading PDF">
                <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
                <p className="text-xs font-semibold text-muted-foreground">
                  {urlLoading ? "Requesting secure access…" : "Loading PDF…"}
                </p>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-[850px] px-3 py-2 h-full md:px-2">
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
                  maxZoom={ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
