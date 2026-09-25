import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cx } from "../../lib/utils";

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  /**
   * Compact mobile breadcrumb typography (text-[10px], desktop unchanged).
   * Matches the student PDF viewer reference. Opt-in only — defaults to
   * the standard size so existing (admin) rendering is unchanged.
   */
  compactBreadcrumb?: boolean;
}

export function PageHeader({ title, subtitle, breadcrumbs, actions, compactBreadcrumb = false }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className={cx("flex flex-wrap items-center gap-1 text-muted-foreground", compactBreadcrumb ? "text-[10px] md:text-sm" : "text-sm")}>
            {breadcrumbs.map((crumb, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />}
                {crumb.to ? (
                  <Link
                    to={crumb.to}
                    className="rounded px-1 py-0.5 font-medium hover:text-primary"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="font-semibold text-foreground">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            title={title}
            className="truncate text-2xl font-bold tracking-tight text-foreground"
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, interactive = false, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cx(
        "card-glow rounded-xl border border-border bg-surface shadow-card",
        onClick && "cursor-pointer transition-colors hover:bg-surface-hover",
        interactive &&
          "transition-all hover:border-primary/40 hover:shadow-card-hover",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  hint?: string;
}

export function StatCard({ label, value, icon, hint }: StatCardProps) {
  return (
    <Card className="flex h-full items-center p-4 sm:p-5">
      <div className="flex w-full items-center gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary sm:size-11">
          <span className="flex size-5 items-center justify-center sm:size-6 [&>svg]:size-5 sm:[&>svg]:size-6">{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
            {label}
          </p>
          <p className="mt-1.5 truncate text-lg font-bold leading-none tracking-tight text-foreground tabular-nums sm:mt-2 sm:text-xl">
            {value}
          </p>
          {hint && (
            <p className="mt-1 truncate text-[11px] font-medium leading-tight text-muted-foreground sm:mt-1.5 sm:text-xs">
              {hint}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
