import { memo, useRef, useState, type ReactNode } from "react";
import {
  Bookmark, ChevronLeft, ChevronRight, Download,
  Maximize2, Minimize2, Minus, Plus,
} from "lucide-react";
import { IconButton } from "../common/IconButton";

/** The single fixed reader-control region: breadcrumb + toolbar behave as
 *  one unit, stuck below the slim reader app header (h-12) via top-12 with
 *  zero gap. Only the document area below scrolls. */
export function ReaderControlRegion({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <header
      className="sticky top-12 z-30 mt-0 flex flex-shrink-0 flex-col border-t-0 bg-surface pt-0"
    >
      {children}
    </header>
  );
}

interface ReaderTitleProps {
  title: string;
  subtitle?: string;
  sourceLabel?: string | null;
  compact?: boolean;
}

/** Title block shared by desktop and mobile toolbars. */
function ReaderTitle({ title, subtitle, sourceLabel, compact = false }: ReaderTitleProps) {
  const subClass = compact
    ? "truncate text-[11px] font-medium leading-tight text-muted-foreground"
    : "truncate text-xs font-medium leading-tight text-muted-foreground";
  const badgeClass = compact
    ? "text-[10px] font-bold text-success"
    : "text-[11px] font-bold text-success";
  return (
    <div className="min-w-0 flex-1">
      <h1 className="truncate text-sm font-bold leading-tight text-foreground">{title}</h1>
      {(subtitle || sourceLabel) && (
        <p className={subClass}>
          {subtitle}
          {subtitle && sourceLabel ? " · " : null}
          {sourceLabel && <span className={badgeClass}>{sourceLabel}</span>}
        </p>
      )}
    </div>
  );
}

interface PageNavProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  onDirectPage?: (page: number) => void;
  compact?: boolean;
}

/** Page navigation group: chevrons + counter (editable input on desktop,
 *  static counter on the compact mobile strip). The desktop input keeps
 *  keystrokes local while editing (draft state) and only navigates on
 *  Enter/blur commit; Escape cancels without navigating. */
const PageNavGroup = memo(function PageNavGroup({ page, totalPages, onPrev, onNext, onDirectPage, compact = false }: PageNavProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const commitDraft = (value: string) => {
    const v = Number(value);
    if (Number.isInteger(v) && v >= 1 && v <= totalPages && v !== page) onDirectPage?.(v);
    setDraft(null);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1 rounded-md bg-surface-muted px-1.5" role="group" aria-label="Page navigation">
        <IconButton icon={ChevronLeft} label="Previous page" variant="bar" size="sm" onClick={onPrev} disabled={page <= 1} />
        <div className="flex h-7 items-center gap-0.5">
          <span className="text-xs font-bold text-foreground">{page}</span>
          <span className="text-[10px] font-medium text-muted-foreground">/ {totalPages}</span>
        </div>
        <IconButton icon={ChevronRight} label="Next page" variant="bar" size="sm" onClick={onNext} disabled={page >= totalPages} />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Page navigation">
      <IconButton icon={ChevronLeft} label="Previous page" variant="bar" onClick={onPrev} disabled={page <= 1} />
      <div className="flex h-10 items-center gap-1 rounded-lg border border-border-strong bg-surface-muted px-2">
        <input
          type="number"
          inputMode="numeric"
          value={draft ?? page}
          min={1}
          max={totalPages}
          disabled={totalPages <= 1}
          onFocus={(e) => {
            cancelRef.current = false;
            setDraft(String(page));
            e.currentTarget.select();
          }}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onBlur={(e) => {
            if (cancelRef.current) {
              cancelRef.current = false;
              return;
            }
            commitDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              cancelRef.current = true;
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
          aria-label="Page number"
          className="w-12 bg-transparent text-center text-sm font-semibold text-foreground focus:outline-none disabled:opacity-40"
        />
        <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">/ {totalPages}</span>
      </div>
      <IconButton icon={ChevronRight} label="Next page" variant="bar" onClick={onNext} disabled={page >= totalPages} />
    </div>
  );
});

interface ZoomGroupProps {
  zoomLabel: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  compact?: boolean;
}

/** Stepped zoom group: [-] % [+] with a live-region percentage. */
const ZoomGroup = memo(function ZoomGroup({ zoomLabel, onZoomIn, onZoomOut, canZoomIn, canZoomOut, compact = false }: ZoomGroupProps) {
  const boxClass = compact
    ? "flex items-center gap-0.5 rounded-md bg-surface-muted px-1"
    : "flex h-9 items-center gap-0.5 rounded-lg border border-border-strong bg-surface-muted px-1";
  const labelClass = compact
    ? "min-w-10 text-center text-[11px] font-bold tabular-nums text-foreground"
    : "min-w-10 text-center text-xs font-bold tabular-nums text-foreground";
  return (
    <div className={boxClass} role="group" aria-label="PDF zoom">
      <IconButton icon={Minus} label="Zoom out PDF" variant="bar" size="sm" onClick={onZoomOut} disabled={!canZoomOut} />
      <span className={labelClass} aria-live="polite" title="PDF zoom level">{zoomLabel}</span>
      <IconButton icon={Plus} label="Zoom in PDF" variant="bar" size="sm" onClick={onZoomIn} disabled={!canZoomIn} />
    </div>
  );
});

interface ActionButtonsProps {
  bookmarked: boolean;
  onBookmarkPage?: () => void;
  downloadActive: boolean;
  onDownloadPress?: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  size?: "sm" | "md";
  compactLabels?: boolean;
}

/** Bookmark / download / fullscreen actions (handlers are the existing
 *  ReaderShell/PdfViewer contracts). */
const ReaderActionButtons = memo(function ReaderActionButtons({
  bookmarked, onBookmarkPage,
  downloadActive, onDownloadPress,
  isFullscreen, onToggleFullscreen,
  size = "md", compactLabels = false,
}: ActionButtonsProps) {
  return (
    <>
      {onBookmarkPage && (
        <IconButton
          icon={Bookmark}
          label={compactLabels ? "Bookmark" : "Bookmark current page"}
          variant={bookmarked ? "bookmark" : "bar"}
          filled={bookmarked}
          size={size}
          onClick={onBookmarkPage}
          aria-pressed={bookmarked}
        />
      )}
      {onDownloadPress && (
        <IconButton
          icon={Download}
          label={compactLabels ? "Download" : "Download resource"}
          variant={downloadActive ? "active" : "bar"}
          size={size}
          onClick={onDownloadPress}
        />
      )}
      <IconButton
        icon={isFullscreen ? Minimize2 : Maximize2}
        label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        variant={isFullscreen ? "active" : "bar"}
        size={size}
        onClick={onToggleFullscreen}
        aria-pressed={isFullscreen}
      />
    </>
  );
});

export interface ReaderToolbarProps {
  toolbarLeading?: ReactNode;
  title: string;
  subtitle?: string;
  sourceLabel?: string | null;
  page: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onDirectPage?: (page: number) => void;
  zoomLabel: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  bookmarked: boolean;
  onBookmarkPage?: () => void;
  downloadActive: boolean;
  onDownloadPress?: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

/** Desktop toolbar: full grouped row (md+). */
export function ReaderToolbarDesktop({
  toolbarLeading, title, subtitle, sourceLabel,
  page, totalPages, onPrevPage, onNextPage, onDirectPage,
  zoomLabel, onZoomIn, onZoomOut, canZoomIn, canZoomOut,
  bookmarked, onBookmarkPage,
  downloadActive, onDownloadPress, isFullscreen, onToggleFullscreen,
}: ReaderToolbarProps) {
  return (
    <div className="hidden min-h-15 items-center gap-2 border-b border-border px-3 md:flex lg:px-4">
      {toolbarLeading}
      <ReaderTitle title={title} subtitle={subtitle} sourceLabel={sourceLabel} />
      <PageNavGroup
        page={page}
        totalPages={totalPages}
        onPrev={onPrevPage}
        onNext={onNextPage}
        onDirectPage={onDirectPage}
      />
      <ZoomGroup
        zoomLabel={zoomLabel}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        canZoomIn={canZoomIn}
        canZoomOut={canZoomOut}
      />
      <ReaderActionButtons
        bookmarked={bookmarked}
        onBookmarkPage={onBookmarkPage}
        downloadActive={downloadActive}
        onDownloadPress={onDownloadPress}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />
    </div>
  );
}

/** Mobile toolbar: compact title row + horizontally scrollable control
 *  strip — every control stays reachable, nothing hides behind a menu. */
export function ReaderToolbarMobile({
  toolbarLeading, title, subtitle, sourceLabel,
  page, totalPages, onPrevPage, onNextPage,
  zoomLabel, onZoomIn, onZoomOut, canZoomIn, canZoomOut,
  bookmarked, onBookmarkPage,
  downloadActive, onDownloadPress, isFullscreen, onToggleFullscreen,
}: ReaderToolbarProps) {
  return (
    <>
      <div className="flex items-center gap-2 border-0 px-3 pb-6 pt-0 md:hidden">
        {toolbarLeading}
        <ReaderTitle title={title} subtitle={subtitle} sourceLabel={sourceLabel} compact />
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-4 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
        <PageNavGroup
          page={page}
          totalPages={totalPages}
          onPrev={onPrevPage}
          onNext={onNextPage}
          compact
        />
        <ZoomGroup
          zoomLabel={zoomLabel}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          compact
        />
        <ReaderActionButtons
          bookmarked={bookmarked}
          onBookmarkPage={onBookmarkPage}
          downloadActive={downloadActive}
          onDownloadPress={onDownloadPress}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
          size="md"
          compactLabels
        />
      </div>
    </>
  );
}
