import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Compact breadcrumb strip pinned to the very top of the fixed reader
 * control region — visually attached to the reader header with zero
 * vertical gap (mt-0, py-0, gap-y-0, leading-none).
 */
export function ReaderBreadcrumb({ children }: { children: ReactNode }) {
  return (
    <nav aria-label="Breadcrumb">
      <div className="mt-0 flex min-h-0 flex-wrap items-center gap-x-0.5 gap-y-0 whitespace-normal rounded-none border-0 px-3 py-0 text-[10px] font-medium leading-none text-muted-foreground/80 md:text-xs">
        {children}
      </div>
    </nav>
  );
}

/** Single chevron separator shared by every reader breadcrumb trail. */
export function BreadcrumbSep() {
  return <ChevronRight className="size-[10px] md:size-3 shrink-0" aria-hidden="true" />;
}

/** Inline trail segment (separator + content) that may wrap as one unit. */
export function BreadcrumbSegment({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-x-0.5 gap-y-0">
      <BreadcrumbSep />
      {children}
    </span>
  );
}
