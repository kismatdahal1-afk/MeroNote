import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Search, Bookmark,
  Download, Maximize2, Minus, Plus, FileText,
} from "lucide-react";
import { getResourceById, getSubjectById } from "../../data/selectors";
import { useLibrary } from "../../state/LibraryProvider";
import { useToast } from "../../state/ToastProvider";
import { IconButton } from "../common/IconButton";
import { clamp } from "../../lib/utils";

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200];

/**
 * Phase 2 reader UI shell.
 * The toolbar + placeholder canvas are intentionally structured so the
 * PDF.js document view can replace the placeholder in Phase 6 without
 * touching toolbar/layout code.
 */
export function ReaderShell() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const resource = getResourceById(resourceId);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getProgress, setReadingProgress, addBookmark, getBookmark, getDownload, startDownload, markOpened } = useLibrary();

  const progress = resource ? getProgress(resource.id) : undefined;
  const [page, setPage] = useState(progress?.lastPage ?? 1);
  const [zoom, setZoom] = useState(100);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  if (!resource) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">Resource not found</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-3 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Go back
          </button>
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
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-950">
      {/* Reader toolbar */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/90 lg:px-4">
        <IconButton icon={ArrowLeft} label="Back to resource" onClick={() => navigate(`/resources/${resource.id}`)} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{resource.title}</h1>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {subject?.name} · {resource.pageCount} pages
          </p>
        </div>

        <div className="hidden items-center gap-1 md:flex">
          <IconButton icon={ChevronLeft} label="Previous page" onClick={() => goToPage(page - 1)} disabled={page <= 1} />
          <div className="flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 dark:border-slate-600 dark:bg-slate-800">
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
              className="w-12 bg-transparent text-center text-sm text-slate-900 focus:outline-none dark:text-white"
            />
            <span className="text-xs whitespace-nowrap text-slate-400">/ {totalPages}</span>
          </div>
          <IconButton icon={ChevronRight} label="Next page" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} />
        </div>

        <div className="hidden items-center gap-0.5 lg:flex">
          <IconButton icon={Minus} label="Zoom out" onClick={() => setZoom(ZOOM_LEVELS[clamp(zoomIndex - 1, 0, ZOOM_LEVELS.length - 1)])} disabled={zoomIndex <= 0} />
          <span className="w-11 text-center text-xs font-medium text-slate-600 dark:text-slate-300">{zoom}%</span>
          <IconButton icon={Plus} label="Zoom in" onClick={() => setZoom(ZOOM_LEVELS[clamp(zoomIndex + 1, 0, ZOOM_LEVELS.length - 1)])} disabled={zoomIndex >= ZOOM_LEVELS.length - 1} />
        </div>

        <IconButton
          icon={Search}
          label={searchOpen ? "Close search" : "Search in document"}
          variant={searchOpen ? "active" : "default"}
          onClick={() => setSearchOpen((s) => !s)}
        />

        <IconButton
          icon={Bookmark}
          label="Bookmark current page"
          variant={bookmarked ? "active" : "default"}
          onClick={handleBookmark}
        />
        <IconButton icon={Download} label="Download resource" variant={download?.status === "completed" ? "active" : "default"} onClick={handleDownload} />
        <IconButton icon={Maximize2} label="Toggle fullscreen" onClick={handleFullscreen} />
      </header>

      {/* In-document search bar */}
      {searchOpen && (
        <div className="sticky top-16 z-20 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700/60 dark:bg-slate-900">
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
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </form>
        </div>
      )}

      {/* Document area — PDF.js replaces this placeholder in Phase 6 */}
      <main className="flex flex-1 justify-center px-4 py-6 lg:py-10">
        <div
          aria-label="Document placeholder"
          style={{ width: `${clamp(zoom, 40, 220)}%`, maxWidth: "56rem" }}
          className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-xl border border-slate-300 bg-white text-slate-300 shadow-sm transition-[width] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
        >
          <FileText className="size-12" aria-hidden="true" />
          <p className="text-sm font-medium">PDF viewer placeholder</p>
          <p className="px-6 text-center text-xs">
            {resource.title} — page {page} of {totalPages}. PDF.js integration arrives in Phase 6.
          </p>
          <Link
            to={`/resources/${resource.id}`}
            className="text-xs font-medium text-indigo-500 hover:underline"
          >
            Resource details
          </Link>
        </div>
      </main>

      {/* Mobile page controls */}
      <footer className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/95 md:hidden">
        <IconButton icon={ChevronLeft} label="Previous page" onClick={() => goToPage(page - 1)} disabled={page <= 1} />
        <div className="flex h-10 items-center gap-1.5 rounded-lg bg-slate-100 px-4 dark:bg-slate-800">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{page}</span>
          <span className="text-xs text-slate-400">/ {totalPages}</span>
        </div>
        <IconButton icon={ChevronRight} label="Next page" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} />
      </footer>
    </div>
  );
}
