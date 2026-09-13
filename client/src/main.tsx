import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { router } from "./router";
import { ThemeProvider } from "./state/ThemeProvider";
import { ToastProvider } from "./state/ToastProvider";
import { LibraryProvider } from "./state/LibraryProvider";
import { UserProvider } from "./state/UserProvider";
import { SemesterStatusProvider } from "./state/SemesterStatusProvider";
import { CmsProvider } from "./state/CmsProvider";

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
