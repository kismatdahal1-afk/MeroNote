import { useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { describePdfError } from "../../lib/pdfErrors";

// Locally bundled worker (no CDN): resolved by Vite in dev and production.
GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfLoadState =
  | { status: "loading" }
  | { status: "ready"; totalPages: number }
  | { status: "error"; message: string };

interface PdfCanvasProps {
  /** Short-lived presigned URL — never stored, only streamed by PDF.js. */
  url: string;
  /** 1-based page to render. */
  page: number;
  /** Render scale (e.g. zoom / 100). */
  scale: number;
  onStateChange?: (state: PdfLoadState) => void;
}

/**
 * Renders exactly one PDF page to canvas. The previous document is destroyed
 * on URL change/unmount; obsolete render tasks are cancelled on page/scale
 * change; stale async completions are ignored via cancellation flags.
 */
export function PdfCanvas({ url, page, scale, onStateChange }: PdfCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const stateRef = useRef(onStateChange);
  stateRef.current = onStateChange;
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);

  // Load the document per URL; destroy the previous one.
  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    stateRef.current?.({ status: "loading" });
    const task = getDocument(url);
    task.promise.then(
      (loaded) => {
        if (cancelled) {
          void loaded.destroy();
          return;
        }
        setDoc(loaded);
        stateRef.current?.({ status: "ready", totalPages: loaded.numPages });
      },
      (err: unknown) => {
        if (!cancelled) stateRef.current?.({ status: "error", message: describePdfError(err) });
      },
    );
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      // Abort an in-flight fetch; the rejection below is ignored via `cancelled`.
      task.destroy().catch(() => {});
      setDoc((prev) => {
        if (prev) void prev.destroy();
        return null;
      });
    };
  }, [url]);

  // Render the requested page; cancel superseded renders.
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || !doc) return;
    const safePage = Math.min(Math.max(1, page), doc.numPages);
    let task: RenderTask | null = null;
    doc.getPage(safePage).then(
      (pdfPage) => {
        if (cancelled) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const viewport = pdfPage.getViewport({ scale: Math.max(0.25, scale) * dpr });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        renderTaskRef.current?.cancel();
        task = pdfPage.render({ canvasContext: canvas.getContext("2d")!, viewport });
        renderTaskRef.current = task;
        task.promise.catch(() => {
          // Cancellations on rapid nav are expected — silent.
        });
      },
      () => {
        if (!cancelled) stateRef.current?.({ status: "error", message: "Couldn't render this page." });
      },
    );
    return () => {
      cancelled = true;
      task?.cancel();
      if (renderTaskRef.current === task) renderTaskRef.current = null;
    };
  }, [doc, page, scale]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`PDF page ${page}`}
      className="block h-auto w-full rounded-lg bg-white"
    />
  );
}
