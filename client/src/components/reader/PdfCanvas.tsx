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
  scale: number;
  onStateChange: (state: PdfLoadState) => void;
  onPageChange?: (page: number, totalPages: number) => void;
}

const PageRenderer = memo(function PageRenderer({
  pdf,
  pageNum,
  scale,
}: {
  pdf: PDFDocumentProxy;
  pageNum: number;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderVersionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const version = ++renderVersionRef.current;

    (async () => {
      const p = await pdf.getPage(pageNum);
      const vp = p.getViewport({ scale });
      const c = canvasRef.current;
      if (!c) return;
      if (cancelled) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssWidth = vp.width;
      const cssHeight = vp.height;

      c.width = Math.round(cssWidth * dpr);
      c.height = Math.round(cssHeight * dpr);
      c.style.width = `${cssWidth}px`;
      c.style.height = `${cssHeight}px`;

      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      const rt = p.render({ canvasContext: ctx, viewport: vp });
      await rt.promise;
      if (!cancelled && version === renderVersionRef.current) {
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdf, pageNum, scale]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full block rounded-lg"
      style={{ imageRendering: "auto" }}
    />
  );
},
);

export function PdfCanvas({ url, page, scale, onStateChange, onPageChange }: PdfCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const destroyedRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pageRef = useRef(page);
  const isInitialMount = useRef(true);
  const onStateChangeRef = useRef(onStateChange);
  const onPageChangeRef = useRef(onPageChange);

  onStateChangeRef.current = onStateChange;
  onPageChangeRef.current = onPageChange;

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadState, setLoadState] = useState<PdfLoadState>({ status: "loading" });
  const [renderSet, setRenderSet] = useState<Set<number>>(new Set());
  const [aspectRatios, setAspectRatios] = useState<Record<number, number>>({});

  const addToRenderSet = useCallback((pages: number[]) => {
    setRenderSet((prev) => {
      const next = new Set(prev);
      let changed = false;
      pages.forEach((p) => {
        if (!next.has(p)) {
          next.add(p);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  const setupObserver = useCallback(() => {
    const container = containerRef.current;
    if (!container || !doc) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const toRender: number[] = [];
        let closestPage = pageRef.current;
        let closestDist = Infinity;
        const center = container.clientHeight / 2;

        entries.forEach((entry) => {
          const num = Number(entry.target.getAttribute("data-page"));
          if (!num) return;
          const rect = entry.boundingClientRect;
          const entryCenter = rect.top + rect.height / 2;
          const dist = Math.abs(entryCenter - (container.getBoundingClientRect().top + center));
          if (dist < closestDist) {
            closestDist = dist;
            closestPage = num;
          }
          if (entry.isIntersecting) {
            toRender.push(num);
          }
        });

        if (toRender.length > 0) {
          addToRenderSet(toRender);
        }

        if (isInitialMount.current) return;

        if (closestPage !== pageRef.current) {
          pageRef.current = closestPage;
          onStateChangeRef.current({ status: "ready", totalPages: doc.numPages });
          onPageChangeRef.current?.(closestPage, doc.numPages);
        }
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

  // Load PDF document — only when URL changes
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
      (pdf: PDFDocumentProxy) => {
        if (cancelled || destroyedRef.current) {
          pdf.destroy();
          return;
        }

        docRef.current = pdf;
        setDoc(pdf);
        setLoadState({ status: "ready", totalPages: pdf.numPages });
        onStateChangeRef.current({ status: "ready", totalPages: pdf.numPages });

        const ratios: Record<number, number> = {};
        Promise.all(
          Array.from({ length: pdf.numPages }, (_, i) =>
            pdf
              .getPage(i + 1)
              .then((p) => {
                const vp = p.getViewport({ scale: 1 });
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
        for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
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
      docRef.current?.destroy();
      docRef.current = null;
      observerRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Scroll to current page when page prop changes (user navigation only)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-page="${page}"]`) as HTMLElement;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [page]);

  // Update observer when doc changes
  const initTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (doc && containerRef.current) {
      const timer = setTimeout(() => {
        setupObserver();
        initTimerRef.current = window.setTimeout(() => {
          isInitialMount.current = false;
        }, 500);
      }, 50);
      return () => {
        clearTimeout(timer);
        if (initTimerRef.current) clearTimeout(initTimerRef.current);
      };
    }
  }, [doc, setupObserver]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      if (initTimerRef.current) clearTimeout(initTimerRef.current);
    };
  }, []);

  const numPages = doc?.numPages ?? 0;

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

  // Memoize the page list to avoid creating new array on every render
  const pageElements = useMemo(() => {
    return Array.from({ length: numPages }, (_, i) => {
      const pageNum = i + 1;
      const ratio = aspectRatios[pageNum] ?? 297 / 210;
      const shouldRender = renderSet.has(pageNum);

      return (
        <div
          key={pageNum}
          data-page={pageNum}
          className="relative w-full max-w-[56rem] shrink-0 overflow-hidden rounded-lg bg-surface border border-border"
          style={{ aspectRatio: `${ratio} / 1` }}
        >
          {shouldRender && doc && (
            <PageRenderer pdf={doc} pageNum={pageNum} scale={scale} />
          )}
        </div>
      );
    });
  }, [numPages, aspectRatios, renderSet, doc, scale]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center gap-3 bg-background px-2 py-4"
    >
      {pageElements}
    </div>
  );
}
