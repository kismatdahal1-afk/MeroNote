import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
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
  renderScale: number;
  onStateChange: (state: PdfLoadState) => void;
  onPageChange?: (page: number, totalPages: number) => void;
}

const MAX_DPR = 2;
const RENDER_WINDOW_ABOVE = 5;
const RENDER_WINDOW_BELOW = 5;
const LEAVE_WINDOW_ABOVE = 8;
const LEAVE_WINDOW_BELOW = 8;

function getDpr(): number {
  return Math.min(window.devicePixelRatio || 1, MAX_DPR);
}

interface PageRendererProps {
  pdf: PDFDocumentProxy;
  pageNum: number;
  renderScale: number;
}

const PageRenderer = memo(function PageRenderer({ pdf, pageNum, renderScale }: PageRendererProps) {
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
        const vp = p.getViewport({ scale: renderScale });
        const c = canvasRef.current;
        if (!c) return;

        c.width = Math.round(vp.width * dpr);
        c.height = Math.round(vp.height * dpr);

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
  }, [pdf, pageNum, renderScale]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full block rounded-lg"
      style={{ height: "auto", imageRendering: "auto" }}
    />
  );
});

interface PageContainerProps {
  pageNum: number;
  ratio: number;
  shouldRender: boolean;
  doc: PDFDocumentProxy | null;
  renderScale: number;
}

const PageContainer = memo(function PageContainer({
  pageNum,
  ratio,
  shouldRender,
  doc,
  renderScale,
}: PageContainerProps) {
  return (
    <div
      data-page={pageNum}
      className="relative w-full shrink-0 rounded-lg bg-surface border border-border"
      style={{ aspectRatio: `${ratio} / 1` }}
    >
      {shouldRender && doc ? (
        <PageRenderer pdf={doc} pageNum={pageNum} renderScale={renderScale} />
      ) : null}
    </div>
  );
});

export function PdfCanvas({ url, page, renderScale, onStateChange, onPageChange }: PdfCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const destroyedRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isInitialMount = useRef(true);
  const onStateChangeRef = useRef(onStateChange);
  const onPageChangeRef = useRef(onPageChange);
  const observerTimerRef = useRef<number | null>(null);
  const pageRef = useRef(page);

  pageRef.current = page;
  onStateChangeRef.current = onStateChange;
  onPageChangeRef.current = onPageChange;

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadState, setLoadState] = useState<PdfLoadState>({ status: "loading" });
  const [renderSet, setRenderSet] = useState<Set<number>>(new Set());
  const [aspectRatios, setAspectRatios] = useState<Record<number, number>>({});

  const updateRenderWindow = useCallback((closestPage: number, totalPages: number) => {
    const enterStart = Math.max(1, closestPage - RENDER_WINDOW_ABOVE);
    const enterEnd = Math.min(totalPages, closestPage + RENDER_WINDOW_BELOW);
    const leaveStart = Math.max(1, closestPage - LEAVE_WINDOW_ABOVE);
    const leaveEnd = Math.min(totalPages, closestPage + LEAVE_WINDOW_BELOW);

    setRenderSet((prev) => {
      const next = new Set<number>();
      for (let i = enterStart; i <= enterEnd; i++) {
        next.add(i);
      }
      // Keep pages already rendered that are within the leave window but outside enter window
      // This prevents oscillation: pages that just left the enter window but are still
      // in the leave window retain their canvas
      let changed = false;
      if (next.size !== prev.size) changed = true;
      for (const p of prev) {
        if (p >= leaveStart && p <= leaveEnd && !next.has(p)) {
          next.add(p);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const removeFromRenderSet = useCallback((pages: number[]) => {
    setRenderSet((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const p of pages) {
        if (next.has(p)) {
          next.delete(p);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const setupObserver = useCallback(() => {
    const container = containerRef.current;
    if (!container || !doc) return;

    observerRef.current?.disconnect();
    let rafId = 0;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          let closestPage = pageRef.current;
          let closestDist = Infinity;
          let anyIntersecting = false;
          const toRender: number[] = [];

          const containerCenter = container.getBoundingClientRect().top + container.clientHeight / 2;

          for (const entry of entries) {
            const num = Number(entry.target.getAttribute("data-page"));
            if (!num) continue;
            const rect = entry.boundingClientRect;
            const entryCenter = rect.top + rect.height / 2;
            const dist = Math.abs(entryCenter - containerCenter);
            if (dist < closestDist) {
              closestDist = dist;
              closestPage = num;
            }
            if (entry.isIntersecting) {
              anyIntersecting = true;
              toRender.push(num);
            }
          }

          if (toRender.length > 0) {
            updateRenderWindow(closestPage, doc.numPages);
          }

          if (isInitialMount.current) return;

          if (closestPage !== pageRef.current) {
            onStateChangeRef.current({ status: "ready", totalPages: doc.numPages });
            onPageChangeRef.current?.(closestPage, doc.numPages);
          }
        });
      },
      {
        root: container,
        rootMargin: "-10% 0px -10% 0px",
        threshold: 0,
      }
    );

    container.querySelectorAll("[data-page]").forEach((el) => {
      observerRef.current?.observe(el);
    });
  }, [doc, updateRenderWindow]);

  useEffect(() => {
    if (!url) {
      setDoc(null);
      setLoadState({ status: "loading" });
      setRenderSet(new Set());
      setAspectRatios({});
      isInitialMount.current = true;
      return;
    }

    destroyedRef.current = false;
    let cancelled = false;

    setLoadState({ status: "loading" });
    setDoc(null);
    setRenderSet(new Set());
    setAspectRatios({});
    isInitialMount.current = true;

    const task = getDocument({
      url,
      disableRange: false,
      disableStream: false,
      disableAutoFetch: false,
    });

    task.promise.then(
      (pdfDoc: PDFDocumentProxy) => {
        if (cancelled || destroyedRef.current) {
          pdfDoc.destroy();
          return;
        }

        setDoc(pdfDoc);
        setLoadState({ status: "ready", totalPages: pdfDoc.numPages });
        onStateChangeRef.current({ status: "ready", totalPages: pdfDoc.numPages });

        const ratios: Record<number, number> = {};
        Promise.all(
          Array.from({ length: pdfDoc.numPages }, (_, i) =>
            pdfDoc
              .getPage(i + 1)
              .then((p) => {
                const vp = p.getViewport({ scale: renderScale });
                ratios[i + 1] = vp.height / vp.width;
              })
              .catch(() => {
                ratios[i + 1] = 297 / 210;
              })
          )
        ).then(() => {
          if (!cancelled && !destroyedRef.current) {
            setAspectRatios(ratios);
          }
        });

        const initial: number[] = [];
        for (let i = 1; i <= Math.min(pdfDoc.numPages, 10); i++) {
          initial.push(i);
        }
        setRenderSet(new Set(initial));
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
      observerRef.current?.disconnect();
    };
  }, [url, renderScale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isInitialMount.current) return;
    const el = container.querySelector(`[data-page="${page}"]`) as HTMLElement;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [page]);

  useEffect(() => {
    if (doc && containerRef.current) {
      const timer = setTimeout(() => {
        setupObserver();
        observerTimerRef.current = window.setTimeout(() => {
          isInitialMount.current = false;
        }, 500);
      }, 50);
      return () => {
        clearTimeout(timer);
        if (observerTimerRef.current) clearTimeout(observerTimerRef.current);
      };
    }
  }, [doc, setupObserver]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      if (observerTimerRef.current) clearTimeout(observerTimerRef.current);
    };
  }, []);

  const numPages = doc?.numPages ?? 0;

  const pageElements = useMemo(() => {
    const elements: React.ReactNode[] = [];
    for (let i = 1; i <= numPages; i++) {
      const ratio = aspectRatios[i] ?? 297 / 210;
      const shouldRender = renderSet.has(i);
      elements.push(
        <PageContainer
          key={i}
          pageNum={i}
          ratio={ratio}
          shouldRender={shouldRender}
          doc={doc}
          renderScale={renderScale}
        />
      );
    }
    return elements;
  }, [numPages, aspectRatios, renderSet, doc, renderScale]);

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
    <div
      ref={containerRef}
      className="flex flex-col items-center gap-3 bg-background px-2 py-4"
    >
      {pageElements}
    </div>
  );
}
