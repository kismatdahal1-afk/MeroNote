import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { router } from "./router";
import { ThemeProvider } from "./state/ThemeProvider";
import { ToastProvider } from "./state/ToastProvider";
import { LibraryProvider } from "./state/LibraryProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <LibraryProvider>
          <RouterProvider router={router} />
        </LibraryProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
