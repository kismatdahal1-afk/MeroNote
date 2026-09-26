import { useEffect, useState } from "react";

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
    // iOS Safari / WKWebView installed-app flag.
    if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
    if (new URLSearchParams(window.location.search).has("pwa")) return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * Defense-in-depth PWA guard for the public landing page.
 * The manifest `start_url` ("/dashboard") is the primary separator —
 * an installed PWA never lands on "/". This hook only covers edge cases
 * (e.g. a standalone window navigated back to "/") by letting LandingPage
 * redirect into the authenticated app entry instead of showing marketing.
 * No effect on normal browser tabs.
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
