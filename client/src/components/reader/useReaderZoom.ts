import { useCallback, useState } from "react";
import { clamp } from "../../lib/utils";

// PDF-only zoom steps, shared by the [-] % [+] buttons and the mobile
// two-finger pinch gesture (single pdfZoom source of truth). Applied to the
// PDF page render width inside PdfCanvas — the header, counter, and shell
// are never scaled. Desktop default stays 100%; mobile opens zoomed out
// for a comfortably framed fit-width view.
export const ZOOM_LEVELS = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5];
export const DEFAULT_ZOOM_INDEX = 4; // 100%
// Mobile-only render reference: on a mobile viewport the 100% UI zoom state
// renders at the existing 40% scale (100% UI -> 0.4 render). Desktop uses 1.
export const MOBILE_RENDER_REFERENCE = 0.4;
// Mobile-only pinch ceiling (UI units): the 0.4 reference caps the shared
// 250% bound at exactly the viewport width, so zoomed content could never
// overflow/pan on mobile. Pinch may continue to 400% UI (1.6x viewport) so
// the same viewport-expansion behavior engages there. Desktop bound,
// button steps, and the 60% floor are unchanged.
export const MOBILE_PINCH_MAX_ZOOM = 4.0;

export function isMobileViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 767px)").matches
  );
}

/**
 * Single source of truth for PDF zoom (UI units, platform-independent).
 * Step logic, continuous mobile pinch commit, and the mobile render
 * reference are preserved exactly from the previous inline implementation —
 * only relocated so visual components stay dumb.
 */
export function useReaderZoom() {
  const [pdfZoom, setPdfZoom] = useState(ZOOM_LEVELS[DEFAULT_ZOOM_INDEX]);
  // UI zoom state stays platform-independent (100% = 1.0 everywhere); only
  // the render mapping is mobile-adjusted. Captured once at mount.
  const [zoomReference] = useState(() =>
    isMobileViewport() ? MOBILE_RENDER_REFERENCE : 1,
  );

  const stepZoom = useCallback((dir: 1 | -1) => {
    setPdfZoom((z) => {
      const top = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
      // A mobile pinch may leave zoom above the top button step: stepping
      // out from there lands on the top step instead of skipping past it.
      // Stepping in stays clamped (the [+] button already disables there).
      // Desktop zoom never exceeds the top step, so this is a no-op there.
      if (z > top) return dir === 1 ? z : top;
      let best = 0;
      for (let i = 0; i < ZOOM_LEVELS.length; i++) {
        if (Math.abs(ZOOM_LEVELS[i] - z) < Math.abs(ZOOM_LEVELS[best] - z)) best = i;
      }
      return ZOOM_LEVELS[clamp(best + dir, 0, ZOOM_LEVELS.length - 1)];
    });
  }, []);
  const zoomIn = useCallback(() => stepZoom(1), [stepZoom]);
  const zoomOut = useCallback(() => stepZoom(-1), [stepZoom]);

  // Mobile pinch commits the exact continuous release value (clamped to
  // 60% UI and the mobile pinch ceiling) so the PDF stays at precisely
  // the size the user left it — never snapped to button steps. Desktop
  // pinch keeps the previous nearest-step commit unchanged. The [-] % [+]
  // buttons use stepZoom above and are untouched. One stable pdfZoom
  // source of truth.
  const handlePinchZoom = useCallback((z: number) => {
    if (isMobileViewport()) {
      const clamped = clamp(z, ZOOM_LEVELS[0], MOBILE_PINCH_MAX_ZOOM);
      setPdfZoom((prev) => (prev === clamped ? prev : clamped));
      return;
    }
    setPdfZoom(() => {
      let best = 0;
      for (let i = 0; i < ZOOM_LEVELS.length; i++) {
        if (Math.abs(ZOOM_LEVELS[i] - z) < Math.abs(ZOOM_LEVELS[best] - z)) best = i;
      }
      return ZOOM_LEVELS[best];
    });
  }, []);

  return {
    pdfZoom,
    zoomReference,
    zoomIn,
    zoomOut,
    handlePinchZoom,
    zoomLabel: `${Math.round(pdfZoom * 100)}%`,
    canZoomOut: pdfZoom > ZOOM_LEVELS[0],
    canZoomIn: pdfZoom < ZOOM_LEVELS[ZOOM_LEVELS.length - 1],
  };
}
