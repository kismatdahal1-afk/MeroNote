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
}

const MAX_DPR = 2;
const PAGE_GAP_PX = 12;
const MAX_CONTAINER_WIDTH = 850;

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
}

const PageRenderer = memo(function PageRenderer({ pdf, pageNum, containerWidth, onRendered }: PageRendererProps) {
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
        if (!c) return;

        const backingW = Math.round(vp.width * dpr);
        const backingH = Math.round(vp.height * dpr);

        c.width = backingW;
        c.height = backingH;

        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const rt = p.render({ canvasContext: ctx, viewport: vp });
        currentRenderPromise = rt.promise;
        renderTaskRef.current = rt.promise;
        await rt.promise;
        if (!cancelledRef.current) {
          onRendered?.(pageNum);
        }
      } catch {
        // Page render failed silently; container still reserves space.
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
  }, [pdf, pageNum, containerWidth, onRendered]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full block rounded-lg"
      style={{ height: "auto", imageRendering: "auto" }}
    />
  );
});

export function PdfCanvas({ url, page, onStateChange, onPageChange }: PdfCanvasProps) {
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

  pageRef.current = page;
  onStateChangeRef.current = onStateChange;
  onPageChangeRef.current = onPageChange;

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadState, setLoadState] = useState<PdfLoadState>({ status: "loading" });
  const [pageInfos, setPageInfos] = useState<PageInfo[]>([]);
  const [containerWidth, setContainerWidth] = useState(850);
  const [scrollTop, setScrollTop] = useState(0);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());

  const handlePageRendered = useCallback((pageNum: number) => {
    setRenderedPages(prev => {
      if (prev.has(pageNum)) return prev;
      const next = new Set(prev);
      next.add(pageNum);
      return next;
    });
  }, []);

  const virtualData = useMemo(() => {
    if (pageInfos.length === 0 || containerWidth <= 0) {
      return { offsets: [0] as number[], totalHeight: 0, numPages: 0 };
    }
    const offsets: number[] = [0];
    let total = 0;
    for (let i = 0; i < pageInfos.length; i++) {
      const h = containerWidth * pageInfos[i].aspectRatio;
      total += h + PAGE_GAP_PX;
      offsets.push(total);
    }
    return { offsets, totalHeight: total, numPages: pageInfos.length };
  }, [pageInfos, containerWidth]);

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

  const nextPageToRender = useMemo(() => {
    if (virtualData.numPages === 0) return 0;
    for (let i = 1; i <= virtualData.numPages; i++) {
      if (!renderedPages.has(i)) return i;
    }
    return virtualData.numPages + 1;
  }, [virtualData, renderedPages]);

  const pageElements = useMemo(() => {
    const elements: React.ReactNode[] = [];
    if (virtualData.numPages === 0 || !doc) return elements;

    for (let i = 1; i <= virtualData.numPages; i++) {
      const dim = pageInfos[i - 1];
      const aspectRatio = dim ? dim.aspectRatio : 297 / 210;
      const top = virtualData.offsets[i - 1];
      const isRendered = renderedPages.has(i);
      const isNextToRender = i === nextPageToRender;

      if (isRendered) {
        elements.push(
          <div
            key={i}
            data-page={i}
            className="absolute left-0 right-0 rounded-lg bg-surface border border-border"
            style={{ top, left: 0, right: 0, width: containerWidth, aspectRatio: `${aspectRatio} / 1` }}
          >
            <PageRenderer pdf={doc} pageNum={i} containerWidth={containerWidth} onRendered={handlePageRendered} />
          </div>
        );
      } else if (isNextToRender) {
        elements.push(
          <div
            key={i}
            data-page={i}
            className="absolute left-0 right-0 rounded-lg bg-surface border border-border flex items-center justify-center"
            style={{ top, left: 0, right: 0, width: containerWidth, aspectRatio: `${aspectRatio} / 1` }}
          >
            <Skeleton className="h-8 w-48" />
          </div>
        );
      } else {
        elements.push(
          <div
            key={i}
            data-page={i}
            className="absolute left-0 right-0 rounded-lg bg-surface border border-border"
            style={{ top, left: 0, right: 0, width: containerWidth, aspectRatio: `${aspectRatio} / 1` }}
          />
        );
      }
    }

    return elements;
  }, [virtualData, pageInfos, doc, containerWidth, renderedPages, nextPageToRender, handlePageRendered]);

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
    const targetTop = virtualData.offsets[Math.max(0, page - 1)] ?? 0;
    const currentScrollTop = scrollContainer.scrollTop;
    if (Math.abs(currentScrollTop - targetTop) > 5) {
      scrollContainer.scrollTop = targetTop;
    }
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  }, [page, virtualData.offsets]);

  useEffect(() => {
    if (!url) {
      setDoc(null);
      setLoadState({ status: "loading" });
      setPageInfos([]);
      setRenderedPages(new Set());
      return;
    }

    destroyedRef.current = false;
    let cancelled = false;

    setLoadState({ status: "loading" });
    setPageInfos([]);
    setRenderedPages(new Set());

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

    const measure = () => {
      const newWidth = container.getBoundingClientRect().width;
      const clampedWidth = Math.min(newWidth, MAX_CONTAINER_WIDTH);
      if (clampedWidth > 0 && Math.abs(clampedWidth - containerWidth) > 1) {
        setContainerWidth(clampedWidth);
      }
    };

    measure();

    const observer = new ResizeObserver((entries) => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(() => {
        const entry = entries[0];
        if (entry) {
          const newWidth = Math.min(
            entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width,
            MAX_CONTAINER_WIDTH
          );
          if (newWidth > 0 && Math.abs(newWidth - containerWidth) > 1) {
            setContainerWidth(newWidth);
          }
        }
      }, 150);
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, [containerWidth]);

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
        className="overflow-y-auto overflow-x-hidden bg-background h-full w-full"
      >
        <div
          className="relative mx-auto"
          style={{
            height: virtualData.totalHeight || undefined,
            maxWidth: containerWidth,
          }}
        >
          {pageElements}
        </div>
      </div>
    </div>
  );
}
