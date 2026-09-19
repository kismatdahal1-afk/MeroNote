import { useEffect, useState, type ReactNode } from "react";
import {
  Bookmark, ChevronLeft, ChevronRight, Download, FileWarning, Loader2,
  Maximize2, Minus, Plus, RectangleHorizontal, RectangleVertical, Search,
} from "lucide-react";
import { IconButton } from "../common/IconButton";
import { useToast } from "../../state/ToastProvider";
import { clamp, cx } from "../../lib/utils";
import { PdfCanvas, type PdfLoadState } from "./PdfCanvas";

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200];
const A4_RATIO = 297 / 210;

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
  /** Secure short-lived PDF URL (Phase 6). Absent = URL still resolving. */
  fileUrl?: string | null;
  /** True while the file URL is being requested from the API. */
  urlLoading?: boolean;
  /** Friendly file-access error (unavailable, no file, offline…). */
  urlError?: string | null;
  /** Retry the file-URL request after an error. */
  onRetryFile?: () => void;
  /** Where the bytes came from ("Saved on device" / "Cached copy" / null). */
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
  // PDF.js page count is authoritative while reading; metadata is the fallback.
  const [docPages, setDocPages] = useState<number | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const totalPages = Math.max(1, docPages ?? resource.pageCount);

  const [page, setPage] = useState(() => clamp(initialPage, 1, totalPages));
  const [zoom, setZoom] = useState(100);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'portrait' | 'landscape'>('portrait');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keep the page in range once the real document reports its length.
  useEffect(() => {
    if (docPages !== null) setPage((p) => clamp(p, 1, docPages));
  }, [docPages]);

  const handlePdfState = (s: PdfLoadState) => {
    if (s.status === "ready") {
      setDocPages(s.totalPages);
      setDocError(null);
    } else if (s.status === "error") {
      setDocError(s.message);
    }
  };

  const goToPage = (next: number) => {
    const p = clamp(next, 1, totalPages);
    setPage(p);
    onPageChange?.(p, totalPages);
  };

  // Fullscreen may be unavailable (standalone PWA, iOS, denied) — the
  // promise rejection must never surface, and system-initiated exits
  // (gesture, Esc) sync back via the fullscreenchange listener below.
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

  const toggleViewMode = () => {
    setViewMode((v) => (v === 'portrait' ? 'landscape' : 'portrait'));
  };

  const zoomIndex = ZOOM_LEVELS.indexOf(zoom);
  const isPage = variant === "page";
  const pageWidth = clamp(zoom, 40, 200);
  const pageMaxWidth = viewMode === 'landscape' ? '72rem' : '56rem';
  const pageAspectRatio = viewMode === 'landscape'
    ? `${A4_RATIO} / 1`
    : `1 / ${A4_RATIO}`;

  return (
    <div
      aria-label="PDF viewer"
      className={cx(
        "reader-bar flex flex-col overflow-hidden",
        isPage
          // dvh tracks the mobile browser chrome (URL bar show/hide) so the
          // reader never jumps or hides content behind it.
          ? "h-screen supports-[height:100dvh]:h-dvh bg-background"
          : "card-glow overflow-hidden rounded-xl border border-border bg-surface shadow-card",
        className,
      )}
    >
      <main
        className={cx(
          "flex-1 min-h-0 overflow-y-auto overflow-x-hidden",
          isPage ? "pb-0" : "",
        )}
      >
        {/* Unified fixed header */}
        <header
          className={cx(
            "sticky top-0 z-30 flex-shrink-0 flex flex-col",
            isPage
              ? "bg-surface/95 backdrop-blur-md"
              : "bg-surface-muted/50",
          )}
        >
          {/* Compact breadcrumb row */}
          {breadcrumbs && isPage && (
            <div className="flex min-h-[1.5rem] flex-wrap items-center gap-0.5 border-b border-border bg-background/95 px-3 py-0.5 text-[10px] md:text-xs font-medium text-muted-foreground/80 backdrop-blur-sm whitespace-nowrap overflow-hidden">
              {breadcrumbs}
            </div>
          )}

          {/* DESKTOP toolbar row */}
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

            <div className="hidden items-center gap-0.5 lg:flex">
              <IconButton icon={Minus} label="Zoom out" variant="bar" onClick={() => setZoom(ZOOM_LEVELS[clamp(zoomIndex - 1, 0, ZOOM_LEVELS.length - 1)])} disabled={zoomIndex <= 0} />
              <span className="w-11 text-center text-xs font-bold text-muted-foreground">{zoom}%</span>
              <IconButton icon={Plus} label="Zoom in" variant="bar" onClick={() => setZoom(ZOOM_LEVELS[clamp(zoomIndex + 1, 0, ZOOM_LEVELS.length - 1)])} disabled={zoomIndex >= ZOOM_LEVELS.length - 1} />
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
                onClick={() => onBookmark(page)}
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
              icon={viewMode === 'portrait' ? RectangleHorizontal : RectangleVertical}
              label={viewMode === 'portrait' ? 'Switch to landscape' : 'Switch to portrait'}
              variant={viewMode === 'landscape' ? "active" : "bar"}
              onClick={toggleViewMode}
              size="sm"
              className="w-12 h-6 px-1.5 rounded"
            />
            <IconButton
              icon={Maximize2}
              label={isFullscreen ? "Exit fullscreen" : "Toggle fullscreen"}
              variant={isFullscreen ? 'active' : 'bar'}
              onClick={handleFullscreen}
            />
          </div>

          {/* MOBILE title row */}
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

          {/* MOBILE controls row — scrolls horizontally on narrow screens
              instead of overflowing; children never shrink. */}
          <div className="flex md:hidden items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
            <div className="flex items-center gap-1 rounded-md bg-surface-muted px-1.5">
              <IconButton icon={ChevronLeft} label="Previous page" variant="bar" size="sm" onClick={() => goToPage(page - 1)} disabled={page <= 1} />
              <div className="flex h-7 items-center gap-0.5">
                <span className="text-xs font-bold text-foreground">{page}</span>
                <span className="text-[10px] font-medium text-muted-foreground">/ {totalPages}</span>
              </div>
              <IconButton icon={ChevronRight} label="Next page" variant="bar" size="sm" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} />
            </div>
            <div className="flex h-7 items-center gap-0.5 rounded-md bg-surface-muted px-1.5">
              <IconButton icon={Minus} label="Zoom out" variant="bar" size="sm" onClick={() => setZoom(ZOOM_LEVELS[clamp(zoomIndex - 1, 0, ZOOM_LEVELS.length - 1)])} disabled={zoomIndex <= 0} />
              <span className="min-w-9 text-center text-xs font-bold text-foreground">{zoom}%</span>
              <IconButton icon={Plus} label="Zoom in" variant="bar" size="sm" onClick={() => setZoom(ZOOM_LEVELS[clamp(zoomIndex + 1, 0, ZOOM_LEVELS.length - 1)])} disabled={zoomIndex >= ZOOM_LEVELS.length - 1} />
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
                onClick={() => onBookmark(page)}
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
              icon={viewMode === 'portrait' ? RectangleHorizontal : RectangleVertical}
              label={viewMode === 'portrait' ? 'Switch to landscape' : 'Switch to portrait'}
              variant={viewMode === 'landscape' ? "active" : "bar"}
              size="sm"
              onClick={toggleViewMode}
              className="w-12 h-6 px-1.5 rounded"
            />
            <IconButton
              icon={Maximize2}
              label={isFullscreen ? "Exit fullscreen" : "Toggle fullscreen"}
              variant={isFullscreen ? 'active' : 'bar'}
              size="sm"
              onClick={handleFullscreen}
            />
          </div>

          {/* In-document search bar */}
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

        {/* Document area */}
        <div className="flex justify-center bg-background px-4 py-6 lg:py-10">
          <div
            aria-label="PDF document area"
            style={
              fileUrl && !urlError && !docError
                ? { width: `${pageWidth}%`, maxWidth: pageMaxWidth }
                : {
                    width: `${pageWidth}%`,
                    maxWidth: pageMaxWidth,
                    aspectRatio: pageAspectRatio,
                  }
            }
            className="card-glow rounded-xl border border-border bg-surface shadow-card transition-[width,aspect-ratio]"
          >
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
              <PdfCanvas url={fileUrl} page={page} scale={zoom / 100} onStateChange={handlePdfState} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
