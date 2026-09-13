import { useLayoutEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

/**
 * Pathless layout: scrolls to the TOP of the viewport on every navigation,
 * so any page (forward click, back button, browser back/forward) always
 * opens at its top view — never mid-page.
 *
 * - `history.scrollRestoration = "manual"` disables the browser's native
 *   back/forward scroll restoration (which would otherwise re-apply the
 *   old mid-page offset before React renders).
 * - `behavior: "instant"` overrides the global smooth scroll-behavior so
 *   the jump is not visible as an animation.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return <Outlet />;
}
