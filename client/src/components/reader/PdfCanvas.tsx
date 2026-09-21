import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import { describePdfError } from "../../lib/pdfErrors";

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
const OVERSCAN_ABOVE = 5;
const OVERSCAN_BELOW = 5;
const PAGE_GAP_PX = 12;

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
}

const PageRenderer = memo(function PageRenderer({ pdf, pageNum, containerWidth }: PageRendererProps) {
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
  }, [pdf, pageNum, containerWidth]);

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
  const scrollFromIndicator = useRef(false);

  pageRef.current = page;
  onStateChangeRef.current = onStateChange;
  onPageChangeRef.current = onPageChange;

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadState, setLoadState] = useState<PdfLoadState>({ status: "loading" });
  const [pageInfos, setPageInfos] = useState<PageInfo[]>([]);
  const [containerWidth, setContainerWidth] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth;
    }
    return 850;
  });
  const [scrollTop, setScrollTop] = useState(0);

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

  const findFirstVisible = useCallback((scrollTop: number): number => {
    const num = virtualData.numPages;
    if (num === 0) return 1;
    let lo = 0;
    let hi = num;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const pageBottom = virtualData.offsets[mid + 1] - PAGE_GAP_PX;
      if (pageBottom <= scrollTop) lo = mid + 1;
      else hi = mid;
    }
    return Math.max(1, lo);
  }, [virtualData]);

  const findLastVisible = useCallback((scrollBottom: number): number => {
    const num = virtualData.numPages;
    if (num === 0) return 0;
    let lo = 1;
    let hi = num;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const pageTop = virtualData.offsets[mid - 1];
      if (pageTop >= scrollBottom) hi = mid - 1;
      else lo = mid;
    }
    return Math.min(num, lo + OVERSCAN_BELOW);
  }, [virtualData]);

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

  const mountedRange = useMemo(() => {
    if (virtualData.numPages === 0) {
      return { start: 1, end: 0 };
    }
    const viewportHeight = viewportHeightRef.current;
    const scrollBottom = scrollTop + viewportHeight;
    const start = findFirstVisible(scrollTop);
    const end = findLastVisible(scrollBottom);
    return { start: Math.max(1, start - OVERSCAN_ABOVE), end };
  }, [virtualData, findFirstVisible, findLastVisible, scrollTop]);

  const pageElements = useMemo(() => {
    const elements: React.ReactNode[] = [];
    if (virtualData.numPages === 0 || !doc) return elements;
    const { start, end } = mountedRange;

    for (let i = start; i <= end; i++) {
      const dim = pageInfos[i - 1];
      const aspectRatio = dim ? dim.aspectRatio : 297 / 210;
      const top = virtualData.offsets[i - 1];

      elements.push(
        <div
          key={i}
          data-page={i}
          className="absolute left-0 right-0 rounded-lg bg-surface border border-border"
          style={{ top, left: 0, right: 0, width: containerWidth, aspectRatio: `${aspectRatio} / 1` }}
        >
          <PageRenderer pdf={doc} pageNum={i} containerWidth={containerWidth} />
        </div>
      );
    }

    return elements;
  }, [virtualData, mountedRange, pageInfos, doc, containerWidth]);

  const updatePageIndicator = useCallback(() => {
    if (isInitialMount.current || virtualData.numPages === 0) return;
    const closestPage = findClosestPage(scrollTop, viewportHeightRef.current);
    if (closestPage !== pageRef.current) {
      scrollFromIndicator.current = true;
      onPageChangeRef.current?.(closestPage, virtualData.numPages);
      scrollFromIndicator.current = false;
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
    if (scrollFromIndicator.current) return;
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    const targetTop = virtualData.offsets[Math.max(0, page - 1)] ?? 0;
    scrollContainer.scrollTop = targetTop;
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  }, [page, virtualData.offsets]);

  useEffect(() => {
    if (!url) {
      setDoc(null);
      setLoadState({ status: "loading" });
      setPageInfos([]);
      return;
    }

    destroyedRef.current = false;
    let cancelled = false;

    setLoadState({ status: "loading" });
    setPageInfos([]);

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
        const defaults = new Array(pdfDoc.numPages).fill({ aspectRatio: 297 / 210 });
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
      if (newWidth > 0 && Math.abs(newWidth - containerWidth) > 1) {
        setContainerWidth(newWidth);
      }
    };

    measure();

    const observer = new ResizeObserver((entries) => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(() => {
        const entry = entries[0];
        if (entry) {
          const newWidth = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
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
    <div ref={containerRef} className="w-full h-full">
      <div
        ref={scrollContainerRef}
        className="overflow-y-auto overflow-x-hidden bg-background h-full"
      >
        <div
          className="relative mx-auto"
          style={{
            height: virtualData.totalHeight || undefined,
            maxWidth: "100%",
          }}
        >
          {pageElements}
        </div>
      </div>
    </div>
  );
}
