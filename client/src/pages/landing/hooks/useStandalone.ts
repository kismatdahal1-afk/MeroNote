import { useEffect, useState } from "react";

interface StandaloneCapableWindow {
  matchMedia?: (query: string) => { matches: boolean };
  navigator?: { standalone?: unknown };
  location?: { search: string };
  Capacitor?: { isNativePlatform?: () => unknown };
}

/**
 * True when the app runs outside a normal browser tab:
 * installed PWA (standalone display-mode / iOS standalone flag) or a
 * native APK wrapper (Capacitor bridge / explicit `?native` launch flag).
 *
 * Deliberately UA-free: screen size, touch support, and mobile OS never
 * count — a mobile browser tab is a NORMAL browser and returns false.
 * Exported for regression tests; the hook below is the runtime entry.
 */
export function detectStandalone(source?: StandaloneCapableWindow): boolean {
  const win =
    source ??
    (typeof window === "undefined"
      ? undefined
      : (window as unknown as StandaloneCapableWindow));
  if (!win) return false;
  try {
    if (win.matchMedia?.("(display-mode: standalone)")?.matches === true) return true;
    // iOS Safari / WKWebView installed-app flag.
    if (win.navigator?.standalone === true) return true;
    // Native APK wrapper: Capacitor runtime bridge (duck-typed so the web
    // build needs no Capacitor dependency) or an explicit launch flag
    // appended by the wrapper (same pattern as the existing `?pwa` flag).
    if (win.Capacitor?.isNativePlatform?.() === true) return true;
    const search = win.location?.search ?? "";
    if (search) {
      const params = new URLSearchParams(search);
      if (params.has("pwa") || params.has("native")) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Defense-in-depth app-entry guard for the public landing page.
 * The manifest `start_url` ("/dashboard") is the primary separator —
 * an installed PWA never lands on "/". This hook only covers edge cases
 * (e.g. a standalone window navigated back to "/", or an APK wrapper
 * opening "/") by letting LandingPage redirect into the authenticated
 * app entry instead of showing marketing. No effect on normal browser
 * tabs, desktop or mobile.
 */
export function useStandalone(): boolean {
  const [standalone, setStandalone] = useState<boolean>(detectStandalone);

  useEffect(() => {
    const mq = window.matchMedia?.("(display-mode: standalone)");
    if (!mq) return;
    const onChange = () => setStandalone(detectStandalone());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return standalone;
}
