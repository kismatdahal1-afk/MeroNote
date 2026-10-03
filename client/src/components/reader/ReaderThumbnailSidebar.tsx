import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { IconButton } from "../common/IconButton";
import { ReaderThumbnail } from "./ReaderThumbnail";

interface ReaderThumbnailSidebarProps {
  doc: PDFDocumentProxy;
  /** Remount key source (file URL): thumbnails reset when the document changes. */
  docKey: string;
  totalPages: number;
  activePage: number;
  open: boolean;
  onToggle: () => void;
  onSelectPage: (page: number) => void;
  thumbWidth?: number;
}

/**
 * Desktop-only thumbnail rail (hidden below md — mobile keeps the Phase 2
 * reader exactly as-is). Own vertical scroll, independent of the main PDF
 * scroll container. Active page follows PdfViewer state; clicks reuse the
 * existing page navigation. Stays mounted while collapsed (hidden) so
 * painted thumbnails survive expand without re-rendering.
 */
export function ReaderThumbnailSidebar({
  doc, docKey, totalPages, activePage, open, onToggle, onSelectPage, thumbWidth = 192,
}: ReaderThumbnailSidebarProps) {
  const itemRefs = useRef(new Map<number, HTMLDivElement>());

  const pages = useMemo(
    () => Array.from({ length: Math.max(0, totalPages) }, (_, i) => i + 1),
    [totalPages],
  );

  // Single stable ref callback (per-page closures would detach/attach on
  // every render). Stale entries are impossible in practice: the parent
  // remounts this sidebar per document, and lookups are guarded by
  // isConnected below.
  const setItemRef = useCallback((el: HTMLDivElement | null) => {
    const n = el?.dataset.page ? Number(el.dataset.page) : NaN;
    if (el && Number.isInteger(n)) itemRefs.current.set(n, el);
  }, []);

  // Keep the active thumbnail visible: instant nearest-scroll, only when
  // the active page changes or the sidebar expands. No state is written,
  // so this can never loop back into page navigation.
  useEffect(() => {
    if (!open) return;
    const el = itemRefs.current.get(activePage);
    if (el?.isConnected) el.scrollIntoView({ block: "nearest" });
  }, [activePage, open]);

  // Collapsed: the list stays mounted but hidden (inline display wins
  // deterministically over the md:flex class) so painted canvases survive
  // expand with zero re-render. The slim rail carries the expand control.
  // Both parts are desktop-only; mobile keeps the Phase 2 reader as-is.
  return (
    <>
      <aside
        aria-label="Page thumbnails"
        className="hidden w-60 flex-shrink-0 flex-col border-r border-border bg-surface md:flex"
        style={open ? undefined : { display: "none" }}
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-1 border-b border-border px-2 py-1">
          <span className="truncate text-[11px] font-bold tabular-nums text-muted-foreground">
            {totalPages} {totalPages === 1 ? "page" : "pages"}
          </span>
          <IconButton
            icon={PanelLeftClose}
            label="Collapse thumbnails"
            variant="bar"
            size="sm"
            onClick={onToggle}
            aria-expanded={true}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
          {pages.map((n) => (
            <div key={`${docKey}-${n}`} data-page={n} ref={setItemRef} className="mb-0.5 last:mb-0">
              <ReaderThumbnail
                doc={doc}
                pageNum={n}
                thumbWidth={thumbWidth}
                active={n === activePage}
                onSelect={onSelectPage}
              />
            </div>
          ))}
        </div>
      </aside>
      {!open && (
        <div
          className="hidden w-10 flex-shrink-0 flex-col items-center border-r border-border bg-surface pt-1 md:flex"
          aria-label="Collapsed thumbnails"
        >
          <IconButton
            icon={PanelLeftOpen}
            label="Expand thumbnails"
            variant="bar"
            size="sm"
            onClick={onToggle}
            aria-expanded={false}
          />
        </div>
      )}
    </>
  );
}
