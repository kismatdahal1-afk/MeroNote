import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BackButtonProps {
  /** Accessible label announced by screen readers. */
  label?: string;
  /** Fallback route used when there is no in-app history to go back to. */
  fallbackTo?: string;
  /** Render chevron only, without the "Back" text (dense toolbars). */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Shared history-aware back button for inner pages.
 * Uses real browser/router history (navigate(-1)) so back-tracking follows
 * the actual navigation chain. Falls back to `fallbackTo` (default: Dashboard)
 * when the current entry is the first visited route (nothing to go back to).
 */
export function BackButton({
  label = "Go back",
  fallbackTo = "/dashboard",
  iconOnly = false,
  className,
}: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        // React Router tracks the current history index in history.state.idx.
        // idx > 0 means there is a previous entry to return to.
        const idx = window.history.state?.idx;
        if (typeof idx === "number" && idx > 0) navigate(-1);
        else navigate(fallbackTo, { replace: true });
      }}
      aria-label={label}
      title={label}
      className={
        "inline-flex h-10 items-center gap-1.5 rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] " +
        (iconOnly ? "w-10 justify-center px-0" : "px-3 text-sm font-semibold") +
        (className ? " " + className : "")
      }
    >
      <ChevronLeft className="size-5 shrink-0" aria-hidden="true" />
      {!iconOnly && <span className="hidden sm:inline">Back</span>}
    </button>
  );
}

