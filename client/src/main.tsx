import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { router } from "./router";import { ThemeProvider } from "./state/ThemeProvider";
import { ToastProvider } from "./state/ToastProvider";
import { LibraryProvider } from "./state/LibraryProvider";
import { UserProvider } from "./state/UserProvider";
import { SemesterStatusProvider } from "./state/SemesterStatusProvider";
import { CmsProvider } from "./state/CmsProvider";

// Phase 9: serve cached shell/API offline. Production only — registering in
// dev would serve stale bundles while iterating. The worker never touches
// IndexedDB, so permanent downloads are unaffected by updates.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is best-effort; the app works fully online without it.
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <UserProvider>
          <LibraryProvider>
            <SemesterStatusProvider>
              <CmsProvider>
                <RouterProvider router={router} />
              </CmsProvider>
            </SemesterStatusProvider>
          </LibraryProvider>
        </UserProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
