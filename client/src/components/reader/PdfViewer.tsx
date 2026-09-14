import { useState, type ReactNode } from "react";
import {
  Bookmark, ChevronLeft, ChevronRight, Download, FileText,
  Maximize2, Minus, Plus, Search,
} from "lucide-react";
import { IconButton } from "../common/IconButton";
import { useToast } from "../../state/ToastProvider";
import { clamp, cx } from "../../lib/utils";

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200];

interface PdfViewerProps {
  /** Resource whose document the viewer displays. */
  resource: { id: string; title: string; pageCount: number };
  /** Secondary toolbar line, e.g. "DBMS · 42 pages". */
  subtitle?: string;
  /** Page opened on mount (student view passes saved reading progress). */
  initialPage?: number;
  /** Called on every page change (student view persists reading progress). */
  onPageChange?: (page: number, totalPages: number) => void;
  /** Leading toolbar slot (student view: back button; admin view: file icon). */
  toolbarLeading?: ReactNode;
  /** Link rendered inside the document placeholder (student view only). */
  placeholderLink?: ReactNode;
  /** Bookmark action, receives the current page; omit to hide the button. */
  onBookmark?: (currentPage: number) => void;
  bookmarked?: boolean;
  /** Download action; omit to hide the button. */
  onDownload?: () => void;
  downloadActive?: boolean;
  /**
   * "page": full-page reader (sticky toolbar, fixed mobile pager) used by
   * the student Reader route. "embedded": inline card used by Admin Topic
   * Detail below the topic header.
   */
  variant?: "page" | "embedded";
  /** Optional breadcrumb row rendered above the toolbar (page variant,
   *  admin reader) showing the navigation source, e.g.
   *  Admin → Resources → [Subject] → [Resource] → PDF. */
  breadcrumbs?: ReactNode;
  className?: string;
}

/**
 * The single PDF viewer implementation, shared by the student Reader page
 * (via ReaderShell) and the admin Topic Detail page. Phase 2 shell: the
 * toolbar + placeholder canvas are intentionally structured so the PDF.js
 * document view can replace the placeholder in Phase 6 without touching
 * consumers.
 */
export function PdfViewer({
  resource,
  subtitle,
  initialPage = 1,
  onPageChange,
  toolbarLeading,
  placeholderLink,
  onBookmark,
  bookmarked = false,
  onDownload,
  downloadActive = false,
  variant = "page",
  breadcrumbs,
  className,
}: PdfViewerProps) {
  const { toast } = useToast();
  const totalPages = Math.max(1, resource.pageCount);

  const [page, setPage] = useState(() => clamp(initialPage, 1, totalPages));
  const [zoom, setZoom] = useState(100);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const goToPage = (next: number) => {
    const p = clamp(next, 1, totalPages);
    setPage(p);
    onPageChange?.(p, totalPages);
  };

  const handleFullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  };

  const zoomIndex = ZOOM_LEVELS.indexOf(zoom);
  const isPage = variant === "page";

  return (
    <div
      aria-label="PDF viewer"
      className={cx(
        "reader-bar flex flex-col",
        isPage
          ? "min-h-screen bg-background"
          : "card-glow overflow-hidden rounded-xl border border-border bg-surface shadow-card",
        className,
      )}
    >
      {/* Navigation path — where the admin came from (admin page variant) */}
      {breadcrumbs && isPage && (
        <div className="sticky top-0 z-40 flex min-h-10 flex-wrap items-center gap-1 border-b border-border bg-background px-4 py-1.5 text-xs font-medium text-muted-foreground">
          {breadcrumbs}
        </div>
      )}

      {/* Reader toolbar */}
      <header
        className={cx(
          "flex items-center gap-2 border-b border-border px-3 lg:px-4",
          isPage
            ? "sticky top-0 z-30 h-16 bg-surface/90 backdrop-blur-md"
            : "h-14 bg-surface-muted/50",
        )}
      >
        {toolbarLeading}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold text-foreground">{resource.title}</h1>
          {subtitle && <p className="truncate text-xs font-medium text-muted-foreground">{subtitle}</p>}
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
        <IconButton icon={Maximize2} label="Toggle fullscreen" variant="bar" onClick={handleFullscreen} />
      </header>

      {/* In-document search bar */}
      {searchOpen && (
        <div
          className={cx(
            "border-b border-border bg-surface px-4 py-2.5",
            isPage && "sticky top-16 z-20",
          )}
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
          </form>
        </div>
      )}

      {/* Document area — PDF.js replaces this placeholder in Phase 6 */}
      <main className="flex flex-1 justify-center bg-background px-4 py-6 lg:py-10">
        <div
          aria-label="Document placeholder"
          style={{ width: `${clamp(zoom, 40, 220)}%`, maxWidth: "56rem" }}
          className="card-glow flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface text-muted-foreground shadow-card transition-[width]"
        >
          <FileText className="size-12" aria-hidden="true" />
          <p className="text-sm font-semibold text-muted-foreground">PDF viewer placeholder</p>
          <p className="px-6 text-center text-xs font-medium text-muted-foreground/80">
            {resource.title} — page {page} of {totalPages}. PDF.js integration arrives in Phase 6.
          </p>
          {placeholderLink}
        </div>
      </main>

      {/* Mobile page controls */}
      <footer
        className={cx(
          "flex items-center justify-center gap-2 border-t border-border p-3 md:hidden",
          isPage
            ? "fixed inset-x-0 bottom-0 z-30 bg-surface/95 backdrop-blur-md"
            : "bg-surface-muted/50",
        )}
      >
        <IconButton icon={ChevronLeft} label="Previous page" variant="bar" onClick={() => goToPage(page - 1)} disabled={page <= 1} />
        <div className="flex h-10 items-center gap-1.5 rounded-lg bg-surface-muted px-4">
          <span className="text-sm font-bold text-foreground">{page}</span>
          <span className="text-xs font-medium text-muted-foreground">/ {totalPages}</span>
        </div>
        <IconButton icon={ChevronRight} label="Next page" variant="bar" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} />
      </footer>
    </div>
  );
}
