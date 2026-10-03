import { memo, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cx } from "../../lib/utils";

interface ReaderThumbnailProps {
  doc: PDFDocumentProxy;
  pageNum: number;
  thumbWidth: number;
  active: boolean;
  onSelect: (page: number) => void;
}

/** Aspect ratio reserved before the first paint (A4 portrait fallback). */
const DEFAULT_ASPECT = 297 / 210;

/**
 * Single lightweight page thumbnail painted from the shared PDF.js document
 * at sidebar scale (DPR 1 — never viewer resolution). Rendering starts only
 * when the tile approaches the viewport (IntersectionObserver, one-shot)
 * and the painted canvas is retained afterwards. The shared document is
 * never destroyed here; stale completions are ignored via a cancelled flag.
 */
export const ReaderThumbnail = memo(function ReaderThumbnail({
  doc, pageNum, thumbWidth, active, onSelect,
}: ReaderThumbnailProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [failed, setFailed] = useState(false);
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);

  // Reveal once: start painting when the tile nears the viewport.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Paint the small canvas from the shared document.
  useEffect(() => {
    if (!visible || rendered) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await doc.getPage(pageNum);
        if (cancelled) return;
        const natural = p.getViewport({ scale: 1 });
        const vp = p.getViewport({ scale: thumbWidth / natural.width });
        setAspect(vp.height / vp.width);
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.max(1, Math.round(vp.width));
        canvas.height = Math.max(1, Math.round(vp.height));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          if (!cancelled) setFailed(true);
          return;
        }
        await p.render({ canvasContext: ctx, viewport: vp }).promise;
        if (!cancelled) setRendered(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, rendered, doc, pageNum, thumbWidth]);

  return (
    <button
      type="button"
      onClick={() => onSelect(pageNum)}
      aria-label={`Go to page ${pageNum}`}
      aria-current={active ? "page" : undefined}
      className={cx(
        "group flex w-full flex-col items-center gap-1 rounded-lg p-2 text-center transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        active ? "bg-primary-muted" : "hover:bg-surface-hover",
      )}
    >
      <span
        ref={wrapRef}
        className={cx(
          "relative block w-full overflow-hidden rounded-md border bg-background",
          active ? "border-primary ring-1 ring-primary" : "border-border",
        )}
        style={{ aspectRatio: `${aspect} / 1` }}
      >
        {!rendered && (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-muted-foreground/60" aria-hidden="true">
            {failed ? `! ${pageNum}` : pageNum}
          </span>
        )}
        <canvas
          ref={canvasRef}
          className={cx("relative block h-auto w-full", !rendered && "hidden")}
          aria-hidden="true"
        />
      </span>
      <span
        className={cx(
          "text-[10px] font-semibold tabular-nums leading-none",
          active ? "text-primary" : "text-muted-foreground",
        )}
        aria-hidden="true"
      >
        {pageNum}
      </span>
    </button>
  );
});
