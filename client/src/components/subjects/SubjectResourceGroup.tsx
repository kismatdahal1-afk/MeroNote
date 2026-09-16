import type { ReactNode } from "react";
import { cx } from "../../lib/utils";

interface SubjectResourceGroupProps {
  icon?: ReactNode;
  title: string;
  count?: number;
  className?: string;
  children: ReactNode;
  /** Soft icon-container tint — theme-aware, defaults to primary blue. */
  tone?: "primary" | "secondary" | "accent" | "success" | "warning" | "error";
}

const TONE_TEXT: Record<NonNullable<SubjectResourceGroupProps["tone"]>, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
};

/**
 * Student-only section wrapper for the Subject Detail page.
 * Groups rows by the Admin-chosen resource type (BOOK / NOTES / ...).
 * Renders only when the caller has resources — never hardcodes data.
 */
export function SubjectResourceGroup({
  icon,
  title,
  count,
  className,
  children,
  tone = "primary",
}: SubjectResourceGroupProps) {
  return (
    <section aria-labelledby={`section-${title.replace(/\s+/g, "-").toLowerCase()}`} className={cx("mb-7", className)}>
      <h2
        id={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}
        className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground"
      >
        {icon && (
          <span
            className={cx(
              "flex size-7 shrink-0 items-center justify-center [&_svg]:size-4",
              TONE_TEXT[tone],
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        {title}
        {count != null && (
          <span className="font-semibold normal-case text-primary/80">({count})</span>
        )}
      </h2>
      {children}
    </section>
  );
}
