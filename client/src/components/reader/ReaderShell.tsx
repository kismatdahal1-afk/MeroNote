import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Search, Bookmark,
  Download, Maximize2, Minus, Plus, FileText,
} from "lucide-react";
import { getResourceById, getSubjectById } from "../../data/selectors";
import { useLibrary } from "../../state/LibraryProvider";
import { useToast } from "../../state/ToastProvider";
import { IconButton } from "../common/IconButton";
import { BackButton } from "../common/BackButton";
import { useCmsSync } from "../common/CmsSync";
import { clamp } from "../../lib/utils";

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200];

/**
 * Phase 2 reader UI shell.
 * The toolbar + placeholder canvas are intentionally structured so the
 * PDF.js document view can replace the placeholder in Phase 6 without
 * touching toolbar/layout code.
 */
export function ReaderShell() {
  useCmsSync();
  const { resourceId } = useParams<{ resourceId: string }>();
  const resource = getResourceById(resourceId);
  const { toast } = useToast();
  const { getProgress, setReadingProgress, addBookmark, getBookmark, getDownload, startDownload, markOpened } = useLibrary();

  const progress = resource ? getProgress(resource.id) : undefined;
  const [page, setPage] = useState(progress?.lastPage ?? 1);
  const [zoom, setZoom] = useState(100);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  if (!resource) {
    return (
      <div className="reader-bar flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">Resource not found</p>
          <div className="mt-3 flex justify-center">
            <BackButton fallbackTo="/dashboard" label="Go back" />
          </div>
        </div>
      </div>
    );
  }

  const subject = getSubjectById(resource.subjectId);
  const bookmarked = Boolean(getBookmark(resource.id));
  const download = getDownload(resource.id);
  const totalPages = resource.pageCount;

  const goToPage = (next: number) => {
    const p = clamp(next, 1, totalPages);
    setPage(p);
    setReadingProgress(resource.id, p, totalPages);
    markOpened(resource.id);
  };

  const handleBookmark = () => {
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

  const handleFullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  };

  const zoomIndex = ZOOM_LEVELS.indexOf(zoom);

  return (
    <div className="reader-bar flex min-h-screen flex-col bg-background">
      {/* Reader toolbar */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur-md lg:px-4">
        <BackButton
          iconOnly
          fallbackTo={`/resources/${resource.id}`}
          label="Back to resource"
          className="text-foreground/75 hover:bg-surface-hover hover:text-foreground"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold text-foreground">{resource.title}</h1>
          <p className="truncate text-xs font-medium text-muted-foreground">
            {subject?.name} · {resource.pageCount} pages
          </p>
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

        <IconButton
          icon={Bookmark}
          label="Bookmark current page"
          variant={bookmarked ? "bookmark" : "bar"}
          filled={bookmarked}
          onClick={handleBookmark}
        />
        <IconButton icon={Download} label="Download resource" variant={download?.status === "completed" ? "active" : "bar"} onClick={handleDownload} />
        <IconButton icon={Maximize2} label="Toggle fullscreen" variant="bar" onClick={handleFullscreen} />
      </header>

      {/* In-document search bar */}
      {searchOpen && (
        <div className="sticky top-16 z-20 border-b border-border bg-surface px-4 py-2.5">
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
          <Link
            to={`/resources/${resource.id}`}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Resource details
          </Link>
        </div>
      </main>

      {/* Mobile page controls */}
      <footer className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 border-t border-border bg-surface/95 p-3 backdrop-blur-md md:hidden">
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
