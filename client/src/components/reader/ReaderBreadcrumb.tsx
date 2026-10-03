import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Minimal single-line breadcrumb strip pinned to the very top of the fixed
 * reader control region — visually attached to the reader header with zero
 * vertical gap (mt-0, py-0, leading-none). One horizontal line only: long
 * trails scroll within the strip instead of wrapping into extra rows.
 */
export function ReaderBreadcrumb({ children }: { children: ReactNode }) {
  return (
    <nav aria-label="Breadcrumb">
      <div className="mt-0 flex min-h-0 flex-nowrap items-center gap-x-0.5 overflow-x-auto whitespace-nowrap rounded-none border-0 px-3 py-1 text-[10px] font-medium leading-none text-muted-foreground/80 [scrollbar-width:none] md:text-xs [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </nav>
  );
}

/** Single chevron separator shared by every reader breadcrumb trail. */
export function BreadcrumbSep() {
  return <ChevronRight className="size-[10px] md:size-3 shrink-0" aria-hidden="true" />;
}

/** Inline trail segment (separator + content) that stays on one line. */
export function BreadcrumbSegment({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 shrink-0 items-center gap-x-0.5">
      <BreadcrumbSep />
      {children}
    </span>
  );
}
