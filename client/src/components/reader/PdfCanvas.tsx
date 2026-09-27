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
  /** Shared-zoom writer used by the PDF-local pinch gesture. Same state
      as the header [-] % [+] buttons: exactly one source of truth.
      Values are UI-space zoom states (the ZOOM_LEVELS steps). */
  onZoomChange?: (zoom: number) => void;
  /** UI-space zoom mirroring the button/snapped state. The pinch gesture
      must calculate from this — NOT from the render-scaled `zoom` prop —
      otherwise a platform render reference (e.g. mobile 0.4) corrupts the
      gesture base and every new pinch restarts from the reference scale.
      Defaults to `zoom` (desktop identity mapping). */
  uiZoom?: number;
  /** Clamp bounds for pinch zoom (defaults cover the supported range). */
  minZoom?: number;
  maxZoom?: number;
}

const MAX_DPR = 2;
const PAGE_GAP_PX = 12;
const MAX_CONTAINER_WIDTH = 850;
const PREFETCH_VIEWPORTS = 1;

function getDpr(): number {
  return Math.min(window.devicePixelRatio || 1, MAX_DPR);
}

function isMobileViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 767px)").matches
  );
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

export function PdfCanvas({ url, page, onStateChange, onPageChange, programmaticScrollRef, zoom = 1, onZoomChange, uiZoom = zoom, minZoom = 0.6, maxZoom = 2.5 }: PdfCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const destroyedRef = useRef(false);
  const isInitialMount = useRef(true);
  const onStateChangeRef = useRef(onStateChange);
  const onPageChangeRef = useRef(onPageChange);
  const pageRef = useRef(page);
  const scrollRafRef = useRef<number | null>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const viewportHeightRef = useRef(0);
  const prevZoomRef = useRef(zoom);
  const uiZoomRef = useRef(uiZoom);
  const onZoomChangeRef = useRef(onZoomChange);
  const pinchRef = useRef<{
    active: boolean;
    smooth: boolean;
    startDist: number;
    startZoom: number;
    liveZoom: number;
    raf: number | null;
    pending: number | null;
    lastSent: number;
    skipAnchorOnce: boolean;
    focalInit: boolean;
    focalContentX: number;
    focalContentY: number;
    focalStartX: number;
    focalStartY: number;
    focalLiveX: number;
    focalLiveY: number;
    contTop: number;
    contLeft: number;
  }>({ active: false, smooth: false, startDist: 0, startZoom: 1, liveZoom: 1, raf: null, pending: null, lastSent: uiZoom, skipAnchorOnce: false, focalInit: false, focalContentX: 0, focalContentY: 0, focalStartX: 0, focalStartY: 0, focalLiveX: 0, focalLiveY: 0, contTop: 0, contLeft: 0 });

  pageRef.current = page;
  onStateChangeRef.current = onStateChange;
  onPageChangeRef.current = onPageChange;
  uiZoomRef.current = uiZoom;
  onZoomChangeRef.current = onZoomChange;

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
      // A two-finger pinch owns its gesture: its focal scroll compensation
      // writes must never echo into page state. One-finger scroll is
      // unaffected (pinch is inactive then).
      if (pinchRef.current.active) return;
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

  // PDF-local two-finger pinch zoom. Listeners live on the PDF scroll
  // container only, so a pinch starting on the header, counter, or any
  // control never reaches this handler and never changes PDF zoom.
  // One-finger touches are never preventDefaulted: native vertical scroll
  // is fully preserved. Only while exactly two fingers are down do we
  // preventDefault (scoped, via { passive: false }) so the browser does
  // not zoom or scroll the page. On mobile viewports the active gesture
  // applies a focal-point compositor-level CSS scale to the
  // already-rendered pages — scaled around the live two-finger midpoint
  // in both axes, with focal scroll compensation keeping the content
  // under the fingers stationary (no PDF.js re-render, no renderWidth
  // change mid-gesture) — and commits the exact live zoom once on release
  // through the shared pdfZoom state (continuous value, clamped to
  // min/max — never snapped to button steps). Desktop keeps the previous
  // direct-commit path unchanged.
  useEffect(() => {
    const sc = scrollContainerRef.current;
    if (!sc || !doc) return;

    const fingerDist = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const fingerMid = (a: Touch, b: Touch) => ({
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2,
    });

    const emitZoom = (value: number) => {
      const rounded = Math.round(value * 1000) / 1000;
      const p = pinchRef.current;
      if (rounded !== p.lastSent) {
        p.lastSent = rounded;
        onZoomChangeRef.current?.(rounded);
      }
    };

    const clearVisualScale = () => {
      const wrap = contentWrapperRef.current;
      if (wrap) {
        wrap.style.transform = "";
        wrap.style.transformOrigin = "";
        wrap.style.willChange = "";
      }
    };

    // Full-2D focal visual: scale around the pinch anchor point (wrapper
    // layout coords, constant for the gesture). Origin is clamped to the
    // wrapper bounds so edge pinches stay predictable.
    const applyVisualScale = (target: number, startZoom: number, originX: number, originY: number) => {
      const wrap = contentWrapperRef.current;
      if (!wrap) return;
      const base = startZoom > 0 ? startZoom : 1;
      const factor = target / base;
      const ox = Math.min(Math.max(originX, 0), Math.max(wrap.offsetWidth, 0));
      const oy = Math.min(Math.max(originY, 0), Math.max(wrap.offsetHeight, 0));
      wrap.style.transformOrigin = `${ox}px ${oy}px`;
      wrap.style.willChange = "transform";
      wrap.style.transform = `scale(${factor})`;
    };

    // Focal scroll compensation, mid-gesture phase: the transform origin is
    // fixed exactly at the anchored content point, so the scale itself
    // holds that point still on screen (screen(C) = C - s, independent of
    // the factor). Scroll therefore follows ONLY finger translation:
    // s = C - mLive. No factor here. This is the ONLY scrollTop/scrollLeft
    // mutation the pinch path performs mid-gesture, and it exists strictly
    // to preserve the focal point. It also cancels any browser pan drift
    // from the same gesture.
    const applyFocalScrollLive = () => {
      const p = pinchRef.current;
      const scEl = scrollContainerRef.current;
      if (!scEl || !p.focalInit) return;
      const maxTop = Math.max(0, scEl.scrollHeight - scEl.clientHeight);
      const maxLeft = Math.max(0, scEl.scrollWidth - scEl.clientWidth);
      scEl.scrollTop = Math.min(Math.max(p.focalContentY - p.focalLiveY, 0), maxTop);
      if (maxLeft > 0) scEl.scrollLeft = Math.min(Math.max(p.focalContentX - p.focalLiveX, 0), maxLeft);
    };

    // Focal scroll compensation, release phase: the transient transform is
    // already cleared and the committed re-render lays out scaled by
    // k = liveZoom / startZoom, so the anchored content identity sits at
    // C*k in the new layout. s2 = C*k - mLive_end lands it on the exact
    // screen px the fingers left: pixel-identical handoff, no jump.
    const applyFocalScrollCommit = () => {
      const p = pinchRef.current;
      const scEl = scrollContainerRef.current;
      if (!scEl || !p.focalInit) return;
      const base = p.startZoom > 0 ? p.startZoom : 1;
      const k = p.liveZoom / base;
      const maxTop = Math.max(0, scEl.scrollHeight - scEl.clientHeight);
      const maxLeft = Math.max(0, scEl.scrollWidth - scEl.clientWidth);
      scEl.scrollTop = Math.min(Math.max(p.focalContentY * k - p.focalLiveY, 0), maxTop);
      if (maxLeft > 0) scEl.scrollLeft = Math.min(Math.max(p.focalContentX * k - p.focalLiveX, 0), maxLeft);
    };

    const flushPending = () => {
      const p = pinchRef.current;
      p.raf = null;
      if (p.pending === null) return;
      const value = p.pending;
      p.pending = null;
      // Mobile smooth path: focal visual scale + focal scroll
      // compensation only — never touch shared zoom state mid-gesture,
      // so no discrete re-render can fire.
      if (p.smooth) {
        applyVisualScale(value, p.startZoom, p.focalStartX, p.focalStartY);
        applyFocalScrollLive();
        return;
      }
      emitZoom(value);
    };

    const scheduleZoom = (value: number) => {
      const p = pinchRef.current;
      p.pending = value;
      if (p.raf === null) {
        p.raf = requestAnimationFrame(flushPending);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const p = pinchRef.current;
        p.active = true;
        p.smooth = isMobileViewport();
        p.startDist = Math.max(1, fingerDist(e.touches[0], e.touches[1]));
        p.startZoom = uiZoomRef.current;
        p.liveZoom = uiZoomRef.current;
        p.lastSent = uiZoomRef.current;
        p.pending = null;
        p.focalInit = false;
        if (p.smooth) {
          clearVisualScale();
          // Capture the 2D focal anchor once per gesture: the exact
          // document coordinate under the pinch midpoint
          // (C = scroll + midpoint-rel-container), plus the transform
          // origin wrapper-local via wrap.offsetLeft/Top read live here.
          // Container rect is cached — the sticky header lives outside
          // this container, so it cannot move mid-gesture.
          const wrap = contentWrapperRef.current;
          if (wrap) {
            const sr = sc.getBoundingClientRect();
            const mid = fingerMid(e.touches[0], e.touches[1]);
            p.contTop = sr.top;
            p.contLeft = sr.left;
            p.focalContentX = sc.scrollLeft + (mid.x - sr.left);
            p.focalContentY = sc.scrollTop + (mid.y - sr.top);
            p.focalStartX = p.focalContentX - wrap.offsetLeft;
            p.focalStartY = p.focalContentY - wrap.offsetTop;
            p.focalLiveX = mid.x - sr.left;
            p.focalLiveY = mid.y - sr.top;
            p.focalInit = true;
          }
          // Own the gesture exclusively while two fingers are down.
          // Restored on every exit path; one-finger scroll never enters.
          sc.style.touchAction = "none";
        }
        // Take over this two-finger gesture only. Single-finger taps
        // (including Retry buttons) never enter this branch.
        if (e.cancelable) e.preventDefault();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const p = pinchRef.current;
      if (!p.active || e.touches.length < 2) return;
      if (e.cancelable) e.preventDefault();
      const d = Math.max(1, fingerDist(e.touches[0], e.touches[1]));
      const target = (p.startZoom * d) / p.startDist;
      const clamped = Math.min(maxZoom, Math.max(minZoom, target));
      if (p.smooth) {
        p.liveZoom = clamped;
        // Track the live midpoint every move: fingers translate during
        // real pinches, and the anchor must follow the current fingers,
        // not the gesture-start position.
        const mid = fingerMid(e.touches[0], e.touches[1]);
        p.focalLiveX = mid.x - p.contLeft;
        p.focalLiveY = mid.y - p.contTop;
      }
      scheduleZoom(clamped);
    };

    const endPinch = () => {
      const p = pinchRef.current;
      if (!p.active) return;
      p.active = false;
      if (p.raf !== null) {
        cancelAnimationFrame(p.raf);
        p.raf = null;
      }
      // Mobile smooth path: seamless focal handoff. The transient visual
      // scale is cleared and the scroll offsets are set for the committed
      // layout in the SAME synchronous block: post-commit layout equals
      // base layout x endFactor exactly (linear zoom mapping), so the
      // corrected frame is pixel-identical to the last gesture frame —
      // no jump, blink, or flash, and the transient horizontal overflow
      // (a pure transform artifact) ceases as the centered fit-width
      // layout returns by construction. The commit uses liveZoom (updated
      // on every touchmove), NOT pending — pending is usually null here
      // because the last rAF already consumed it into the visual scale.
      // The release commit must not yank the scroll position either (flag
      // consumed by the zoom effect); it only applies when a value is
      // actually emitted.
      if (p.smooth) {
        p.smooth = false;
        clearVisualScale();
        applyFocalScrollCommit();
        sc.style.touchAction = "pan-x pan-y";
        const value = p.liveZoom;
        p.pending = null;
        p.focalInit = false;
        if (Math.round(value * 1000) / 1000 !== Math.round(p.lastSent * 1000) / 1000) {
          p.skipAnchorOnce = true;
          emitZoom(value);
        }
        return;
      }
      // Settle the exact final value synchronously on release. The release
      // commit must not yank the scroll position either (flag consumed by
      // the zoom effect); it only applies when a value is actually emitted.
      if (p.pending !== null) {
        const value = p.pending;
        p.pending = null;
        p.skipAnchorOnce = true;
        emitZoom(value);
      }
    };

    // iOS Safari proprietary gesture event: blocking it scoped to the PDF
    // region stops browser page-zoom without touching global viewport config.
    const onGestureStart = (e: Event) => e.preventDefault();

    sc.addEventListener("touchstart", onTouchStart, { passive: false });
    sc.addEventListener("touchmove", onTouchMove, { passive: false });
    sc.addEventListener("touchend", endPinch);
    sc.addEventListener("touchcancel", endPinch);
    sc.addEventListener("gesturestart", onGestureStart);

    return () => {
      sc.removeEventListener("touchstart", onTouchStart);
      sc.removeEventListener("touchmove", onTouchMove);
      sc.removeEventListener("touchend", endPinch);
      sc.removeEventListener("touchcancel", endPinch);
      sc.removeEventListener("gesturestart", onGestureStart);
      const p = pinchRef.current;
      if (p.raf !== null) {
        cancelAnimationFrame(p.raf);
        p.raf = null;
      }
      p.active = false;
      p.smooth = false;
      p.pending = null;
      p.skipAnchorOnce = false;
      p.focalInit = false;
      sc.style.touchAction = "pan-x pan-y";
      clearVisualScale();
    };
  }, [doc, minZoom, maxZoom]);

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
  // never scroll. During (or just after) a pinch gesture the scroll
  // position is never moved — the counter is resynced from the live scroll
  // offset with the fresh geometry instead, so pinch never causes a
  // scroll-position jump. Jump/prev/next offsets remain exact.
  useEffect(() => {
    if (prevZoomRef.current === zoom) return;
    prevZoomRef.current = zoom;
    const sc = scrollContainerRef.current;
    if (!sc || virtualData.numPages === 0) return;
    if (pinchRef.current.active || pinchRef.current.skipAnchorOnce) {
      pinchRef.current.skipAnchorOnce = false;
      const h = sc.clientHeight;
      const closest = findClosestPage(sc.scrollTop, h > 0 ? h : viewportHeightRef.current);
      if (closest !== pageRef.current) {
        onPageChangeRef.current?.(closest, virtualData.numPages);
      }
      return;
    }
    const clamped = Math.max(1, Math.min(virtualData.numPages, pageRef.current));
    const targetTop = virtualData.offsets[clamped - 1] ?? 0;
    if (Math.abs(sc.scrollTop - targetTop) > 2) {
      sc.scrollTop = targetTop;
    }
  }, [zoom, virtualData, findClosestPage]);

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
          className="overflow-y-auto overscroll-contain bg-background h-full w-full"
          // Scoped to the PDF region only: the browser may pan here
          // (one-finger scroll preserved) but may not pinch-zoom or
          // double-tap-zoom the page. Global app zoom behavior untouched.
          // overscroll-contain: gestures hitting the top/bottom boundary
          // stay inside this container and never chain out to ancestors,
          // so overscroll can never slide the fixed Reader header.
          style={{ touchAction: "pan-x pan-y" }}
        >
        <div
          ref={contentWrapperRef}
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
