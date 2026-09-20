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

  useEffect(() => {
    cancelledRef.current = false;
    const dpr = getDpr();

    (async () => {
      const p = await pdf.getPage(pageNum);
      const vp = p.getViewport({ scale: renderScale });
      const c = canvasRef.current;
      if (!c || cancelledRef.current) return;

      c.width = Math.round(vp.width * dpr);
      c.height = Math.round(vp.height * dpr);

      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const rt = p.render({ canvasContext: ctx, viewport: vp });
      await rt.promise;
    })();

    return () => {
      cancelledRef.current = true;
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

  const addToRenderSet = useCallback((pages: number[]) => {
    setRenderSet((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const p of pages) {
        if (!next.has(p)) {
          next.add(p);
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
          const toRender: number[] = [];
          let closestPage = pageRef.current;
          let closestDist = Infinity;
          const center = container.clientHeight / 2;

          for (const entry of entries) {
            const num = Number(entry.target.getAttribute("data-page"));
            if (!num) continue;
            const rect = entry.boundingClientRect;
            const entryCenter = rect.top + rect.height / 2;
            const dist = Math.abs(
              entryCenter - (container.getBoundingClientRect().top + center)
            );
            if (dist < closestDist) {
              closestDist = dist;
              closestPage = num;
            }
            if (entry.isIntersecting) {
              toRender.push(num);
            }
          }

          if (toRender.length > 0) {
            addToRenderSet(toRender);
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
  }, [doc, addToRenderSet]);

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

    const task = getDocument({ url });

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
        addToRenderSet(initial);
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
  }, [url, renderScale, addToRenderSet]);

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
        <div
          key={i}
          data-page={i}
          className="relative w-full shrink-0 rounded-lg bg-surface border border-border"
          style={{ aspectRatio: `${ratio} / 1` }}
        >
          {shouldRender && doc ? (
            <PageRenderer pdf={doc} pageNum={i} renderScale={renderScale} />
          ) : null}
        </div>
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
