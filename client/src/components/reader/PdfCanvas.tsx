import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import { describePdfError } from "../../lib/pdfErrors";
import { Skeleton } from "../common/Skeleton";

try {
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString();
} catch {}

export interface PdfLoadState {
  status: "loading" | "ready" | "error";
  totalPages?: number;
  message?: string;
}

interface PdfCanvasProps {
  url: string | null;
  page: number;
  onStateChange: (state: PdfLoadState) => void;
  onPageChange?: (page: number, totalPages: number) => void;
  programmaticScrollRef?: React.MutableRefObject<boolean>;
  /** PDF-only zoom multiplier (1 = fit width). Affects page render width
      and reserved geometry only — never the header, counter, or shell. */
  zoom?: number;
}

const MAX_DPR = 2;
const PAGE_GAP_PX = 12;
const MAX_CONTAINER_WIDTH = 850;
const PREFETCH_VIEWPORTS = 1;

function getDpr(): number {
  return Math.min(window.devicePixelRatio || 1, MAX_DPR);
}

interface PageInfo {
  aspectRatio: number;
}

interface PageRendererProps {
  pdf: PDFDocumentProxy;
  pageNum: number;
  containerWidth: number;
  onRendered?: (pageNum: number) => void;
  onRenderError?: (pageNum: number, error: unknown) => void;
}

const PageRenderer = memo(function PageRenderer({ pdf, pageNum, containerWidth, onRendered, onRenderError }: PageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cancelledRef = useRef(false);
  const renderTaskRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    cancelledRef.current = false;
    const dpr = getDpr();

    const task = (async () => {
      let currentRenderPromise: Promise<void> | null = null;
      try {
        const p = await pdf.getPage(pageNum);
        if (cancelledRef.current) return;

        const naturalVp = p.getViewport({ scale: 1 });
        const scale = containerWidth / naturalVp.width;
        const vp = p.getViewport({ scale });

        const c = canvasRef.current;
        if (!c) {
          if (!cancelledRef.current) onRenderError?.(pageNum, new Error("Canvas unavailable."));
          return;
        }

        const backingW = Math.round(vp.width * dpr);
        const backingH = Math.round(vp.height * dpr);

        c.width = backingW;
        c.height = backingH;

        const ctx = c.getContext("2d");
        if (!ctx) {
          if (!cancelledRef.current) onRenderError?.(pageNum, new Error("2D context unavailable."));
          return;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const rt = p.render({ canvasContext: ctx, viewport: vp });
        currentRenderPromise = rt.promise;
        renderTaskRef.current = rt.promise;
        await rt.promise;
        if (!cancelledRef.current) {
          onRendered?.(pageNum);
        }
      } catch (err) {
        if (!cancelledRef.current) {
          onRenderError?.(pageNum, err);
        }
      } finally {
        if (renderTaskRef.current === currentRenderPromise) {
          renderTaskRef.current = null;
        }
      }
    })();

    renderTaskRef.current = task;

    return () => {
      cancelledRef.current = true;
      renderTaskRef.current = null;
    };
  }, [pdf, pageNum, containerWidth, onRendered, onRenderError]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full block rounded-lg"
      style={{ height: "auto", imageRendering: "auto" }}
    />
  );
});

export function PdfCanvas({ url, page, onStateChange, onPageChange, programmaticScrollRef, zoom = 1 }: PdfCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const destroyedRef = useRef(false);
  const isInitialMount = useRef(true);
  const onStateChangeRef = useRef(onStateChange);
  const onPageChangeRef = useRef(onPageChange);
  const pageRef = useRef(page);
  const scrollRafRef = useRef<number | null>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const viewportHeightRef = useRef(0);
  const prevZoomRef = useRef(zoom);

  pageRef.current = page;
  onStateChangeRef.current = onStateChange;
  onPageChangeRef.current = onPageChange;

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadState, setLoadState] = useState<PdfLoadState>({ status: "loading" });
  const [pageInfos, setPageInfos] = useState<PageInfo[]>([]);
  const [containerWidth, setContainerWidth] = useState(850);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [erroredPages, setErroredPages] = useState<Set<number>>(new Set());

  // Effective PDF page display/render width. Zoom scales the measured
  // container width; every consumer below (reserved heights, offsets,
  // canvas scale, element widths) derives from this one value so visual
  // geometry and calculated geometry can never disagree.
  const renderWidth = useMemo(
    () => Math.max(0, containerWidth * zoom),
    [containerWidth, zoom],
  );

  const handlePageRendered = useCallback((pageNum: number) => {
    setRenderedPages(prev => {
      if (prev.has(pageNum)) return prev;
      const next = new Set(prev);
      next.add(pageNum);
      return next;
    });
    setErroredPages(prev => {
      if (!prev.has(pageNum)) return prev;
      const next = new Set(prev);
      next.delete(pageNum);
      return next;
    });
  }, []);

  const handleRenderError = useCallback((pageNum: number) => {
    setErroredPages(prev => {
      if (prev.has(pageNum)) return prev;
      const next = new Set(prev);
      next.add(pageNum);
      return next;
    });
  }, []);

  const retryPage = useCallback((pageNum: number) => {
    setErroredPages(prev => {
      if (!prev.has(pageNum)) return prev;
      const next = new Set(prev);
      next.delete(pageNum);
      return next;
    });
  }, []);

  const virtualData = useMemo(() => {
    if (pageInfos.length === 0 || renderWidth <= 0) {
      return { offsets: [0] as number[], totalHeight: 0, numPages: 0 };
    }
    const offsets: number[] = [0];
    let total = 0;
    for (let i = 0; i < pageInfos.length; i++) {
      const h = renderWidth * pageInfos[i].aspectRatio;
      total += h + PAGE_GAP_PX;
      offsets.push(total);
    }
    return { offsets, totalHeight: total, numPages: pageInfos.length };
  }, [pageInfos, renderWidth]);

  const findClosestPage = useCallback((scrollTop: number, viewportHeight: number): number => {
    const num = virtualData.numPages;
    if (num === 0) return 1;
    const center = scrollTop + viewportHeight / 2;
    let closest = 1;
    let closestDist = Infinity;
    for (let i = 1; i <= num; i++) {
      const pageTop = virtualData.offsets[i - 1];
      const pageHeight = (virtualData.offsets[i] - virtualData.offsets[i - 1]) - PAGE_GAP_PX;
      const pageCenter = pageTop + pageHeight / 2;
      const dist = Math.abs(pageCenter - center);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    return closest;
  }, [virtualData]);

  const activeLoadingPage = useMemo(() => {
    if (virtualData.numPages === 0) return 0;
    if (renderedPages.size >= virtualData.numPages) return virtualData.numPages + 1;
    if (viewportHeight <= 0) {
      const target = Math.max(1, Math.min(virtualData.numPages, page));
      if (!renderedPages.has(target)) return target;
      if (target !== 1 && !renderedPages.has(1)) return 1;
      return 0;
    }
    const viewportBottom = scrollTop + viewportHeight;
    const limit = viewportBottom + viewportHeight * PREFETCH_VIEWPORTS;
    const current = Math.max(1, Math.min(virtualData.numPages, findClosestPage(scrollTop, viewportHeight)));
    const isEligible = (p: number) => virtualData.offsets[p - 1] <= limit;
    if (!renderedPages.has(current)) {
      return isEligible(current) ? current : 0;
    }
    for (let i = current + 1; i <= virtualData.numPages; i++) {
      if (!renderedPages.has(i)) {
        return isEligible(i) ? i : 0;
      }
    }
    return virtualData.numPages + 1;
  }, [virtualData, renderedPages, scrollTop, viewportHeight, page, findClosestPage]);

  const pageElements = useMemo(() => {
    const elements: React.ReactNode[] = [];
    if (virtualData.numPages === 0 || !doc) return elements;

    for (let i = 1; i <= virtualData.numPages; i++) {
      const dim = pageInfos[i - 1];
      const aspectRatio = dim ? dim.aspectRatio : 297 / 210;
      const top = virtualData.offsets[i - 1];
      const isRendered = renderedPages.has(i);
      const isErrored = !isRendered && erroredPages.has(i);
      const isActiveLoading = !isRendered && !isErrored && i === activeLoadingPage;

      if (isRendered) {
        elements.push(
          <div
            key={i}
            data-page={i}
            className="absolute left-0 right-0 rounded-lg bg-surface border border-border"
            style={{ top, left: 0, right: 0, width: renderWidth, aspectRatio: `${aspectRatio} / 1` }}
          >
            <PageRenderer pdf={doc} pageNum={i} containerWidth={renderWidth} onRendered={handlePageRendered} onRenderError={handleRenderError} />
          </div>
        );
      } else if (isErrored) {
        elements.push(
          <div
            key={i}
            data-page={i}
            className="absolute left-0 right-0 rounded-lg bg-surface border border-border flex flex-col items-center justify-center gap-2 p-4 text-center"
            style={{ top, left: 0, right: 0, width: renderWidth, aspectRatio: `${aspectRatio} / 1` }}
          >
            <p className="text-xs font-semibold text-foreground">Couldn&apos;t render this page</p>
            <button
              type="button"
              onClick={() => retryPage(i)}
              className="rounded-lg bg-primary-muted px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary-muted-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Retry
            </button>
          </div>
        );
      } else if (isActiveLoading) {
        elements.push(
          <div
            key={i}
            data-page={i}
            className="absolute left-0 right-0 rounded-lg bg-surface border border-border"
            style={{ top, left: 0, right: 0, width: renderWidth, aspectRatio: `${aspectRatio} / 1` }}
          >
            <PageRenderer pdf={doc} pageNum={i} containerWidth={renderWidth} onRendered={handlePageRendered} onRenderError={handleRenderError} />
            <div className="absolute inset-0 flex items-center justify-center bg-surface rounded-lg" aria-hidden="true">
              <Skeleton className="h-8 w-48" />
            </div>
          </div>
        );
      } else {
        elements.push(
          <div
            key={i}
            data-page={i}
            className="absolute left-0 right-0 rounded-lg bg-surface border border-border"
            style={{ top, left: 0, right: 0, width: renderWidth, aspectRatio: `${aspectRatio} / 1` }}
          />
        );
      }
    }

    return elements;
  }, [virtualData, pageInfos, doc, renderWidth, renderedPages, erroredPages, activeLoadingPage, handlePageRendered, handleRenderError, retryPage]);

  const updatePageIndicator = useCallback(() => {
    if (isInitialMount.current || virtualData.numPages === 0) return;
    const closestPage = findClosestPage(scrollTop, viewportHeightRef.current);
    if (closestPage !== pageRef.current) {
      onPageChangeRef.current?.(closestPage, virtualData.numPages);
    }
  }, [virtualData, findClosestPage, scrollTop]);

  const handleScroll = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const sc = scrollContainerRef.current;
      if (!sc || virtualData.numPages === 0) return;
      const newScrollTop = sc.scrollTop;
      const newViewportHeight = sc.clientHeight;
      viewportHeightRef.current = newViewportHeight;
      setViewportHeight(prev => (prev === newViewportHeight ? prev : newViewportHeight));
      setScrollTop(newScrollTop);
      updatePageIndicator();
    });
  }, [virtualData, updatePageIndicator]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [handleScroll]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const targetTop = virtualData.offsets[Math.max(0, page - 1)] ?? 0;
      if (Math.abs(scrollContainer.scrollTop - targetTop) > 5) {
        scrollContainer.scrollTop = targetTop;
      }
      if (programmaticScrollRef) programmaticScrollRef.current = false;
      return;
    }
    if (!programmaticScrollRef?.current) return;
    const targetTop = virtualData.offsets[Math.max(0, page - 1)] ?? 0;
    const currentScrollTop = scrollContainer.scrollTop;
    if (Math.abs(currentScrollTop - targetTop) > 5) {
      scrollContainer.scrollTop = targetTop;
    }
    programmaticScrollRef.current = false;
  }, [page, virtualData.offsets]);

  // Zoom changes every reserved page height, so re-anchor the scroll
  // position to the top of the current page using the fresh geometry.
  // Guarded by prevZoomRef: plain resizes and the initial pageInfos load
  // never scroll. The counter stays on the current page with no spurious
  // onPageChange, and jump/prev/next offsets remain exact.
  useEffect(() => {
    if (prevZoomRef.current === zoom) return;
    prevZoomRef.current = zoom;
    const sc = scrollContainerRef.current;
    if (!sc || virtualData.numPages === 0) return;
    const clamped = Math.max(1, Math.min(virtualData.numPages, pageRef.current));
    const targetTop = virtualData.offsets[clamped - 1] ?? 0;
    if (Math.abs(sc.scrollTop - targetTop) > 2) {
      sc.scrollTop = targetTop;
    }
  }, [zoom, virtualData]);

  useEffect(() => {
    if (!doc || virtualData.numPages === 0) return;
    const sc = scrollContainerRef.current;
    if (!sc) return;
    const h = sc.clientHeight;
    if (h > 0) {
      viewportHeightRef.current = h;
      setViewportHeight(prev => (prev === h ? prev : h));
    }
  }, [doc, virtualData.numPages]);

  useEffect(() => {
    if (!url) {
      setDoc(null);
      setLoadState({ status: "loading" });
      setPageInfos([]);
      setRenderedPages(new Set());
      setErroredPages(new Set());
      return;
    }

    destroyedRef.current = false;
    let cancelled = false;

    setLoadState({ status: "loading" });
    setPageInfos([]);
    setRenderedPages(new Set());
    setErroredPages(new Set());

    const task = getDocument({
      url,
      disableRange: false,
      disableStream: false,
      disableAutoFetch: false,
    });

    task.promise.then(
      (pdfDoc: PDFDocumentProxy) => {
        if (cancelled || destroyedRef.current) { pdfDoc.destroy(); return; }
        setDoc(pdfDoc);
        setLoadState({ status: "ready", totalPages: pdfDoc.numPages });
        onStateChangeRef.current({ status: "ready", totalPages: pdfDoc.numPages });

        const infos: PageInfo[] = new Array(pdfDoc.numPages);
        const defaults = Array.from({ length: pdfDoc.numPages }, () => ({ aspectRatio: 297 / 210 }));
        setPageInfos(defaults);

        let remaining = pdfDoc.numPages;
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          pdfDoc.getPage(i).then((p) => {
            if (cancelled) return;
            const vp = p.getViewport({ scale: 1 });
            infos[i - 1] = { aspectRatio: vp.height / vp.width };
            remaining--;
            if (remaining === 0 && !cancelled) {
              setPageInfos(infos);
            }
          }).catch(() => {
            if (cancelled) return;
            remaining--;
            if (remaining === 0 && !cancelled) {
              setPageInfos(infos);
            }
          });
        }
      },
      (err: unknown) => {
        if (cancelled || destroyedRef.current) return;
        const msg = describePdfError(err);
        setLoadState({ status: "error", message: msg });
        onStateChangeRef.current({ status: "error", message: msg });
      }
    );

    return () => {
      cancelled = true;
      destroyedRef.current = true;
      task.destroy?.();
    };
  }, [url]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Floor to whole CSS pixels: page elements are absolutely positioned
    // with this exact width, so a fractional width could exceed the scroll
    // container by a subpixel and cause horizontal drift on mobile.
    const clampWidth = (raw: number) => {
      const clampedWidth = Math.floor(Math.min(raw, MAX_CONTAINER_WIDTH));
      if (clampedWidth > 0) {
        setContainerWidth((prev) => (prev === clampedWidth ? prev : clampedWidth));
      }
    };

    const measure = () => {
      clampWidth(container.getBoundingClientRect().width);
    };

    measure();

    const observer = new ResizeObserver((entries) => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(() => {
        const entry = entries[0];
        if (entry) {
          clampWidth(
            entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
          );
        }
      }, 150);
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, []);

  if (loadState.status === "loading") {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8" role="status" aria-label="Loading PDF">
        <svg className="size-7 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-xs font-semibold text-muted-foreground">Loading PDF…</p>
      </div>
    );
  }

  if (loadState.status === "error") {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-bold text-foreground">Couldn't open this PDF</p>
        <p className="max-w-sm text-xs font-medium text-muted-foreground">{loadState.message}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full flex justify-center">
        <div
          ref={scrollContainerRef}
          className="overflow-y-auto bg-background h-full w-full"
        >
        <div
          className="relative mx-auto"
          style={{
            height: virtualData.totalHeight || undefined,
            maxWidth: renderWidth,
          }}
        >
          {pageElements}
        </div>
      </div>
    </div>
  );
}
