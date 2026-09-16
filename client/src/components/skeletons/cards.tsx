import { cx } from "../../lib/utils";
import { SkBox, SkCircle } from "./primitives";

/**
 * Shared skeleton card shapes. Each mirrors its real card's responsive
 * structure (mobile compact row + desktop body with the same visibility
 * breakpoints), so grids never shift when content arrives.
 */

function range(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

/* ---------------- Resource card (Resources/Favorites/Downloads) ---------------- */

export function SkResourceCard() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 sm:p-5">
      {/* Mobile compact row */}
      <div className="sm:hidden">
        <div className="flex items-center gap-2.5">
          <SkBox className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <SkBox className="h-4 w-4/5" />
            <SkBox className="mt-1.5 h-3 w-3/5" />
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <SkCircle className="size-8" />
            <SkCircle className="size-8" />
          </div>
        </div>
        <SkBox className="mt-2.5 h-9 w-full rounded-lg" />
      </div>
      {/* Desktop body */}
      <div className="hidden flex-1 flex-col sm:flex">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <SkBox className="size-10 shrink-0 rounded-lg" />
            <SkBox className="h-6 w-24 rounded-full" />
          </div>
          <div className="flex items-center gap-0.5">
            <SkCircle className="size-8" />
            <SkCircle className="size-8" />
          </div>
        </div>
        <div className="mt-3 flex-1">
          <SkBox className="h-4 w-full" />
          <SkBox className="mt-1.5 h-4 w-2/3" />
          <SkBox className="mt-1.5 h-3 w-1/2" />
        </div>
        <div className="mt-3 flex gap-1.5">
          <SkBox className="h-5 w-14 rounded-md" />
          <SkBox className="h-5 w-16 rounded-md" />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <SkBox className="h-3.5 w-28" />
          <SkBox className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function SkResourceGrid({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cx("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {range(count).map((i) => (
        <SkResourceCard key={i} />
      ))}
    </div>
  );
}

/* ---------------- Mobile compact resource rows (SubjectDetail) ---------------- */

export function SkRowList({ count = 4 }: { count?: number }) {
  return (
    <ul className="space-y-2.5 sm:hidden">
      {range(count).map((i) => (
        <li key={i} className="rounded-xl border border-border bg-surface px-3.5 py-3">
          <div className="flex items-center gap-3">
            <SkBox className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <SkBox className="h-4 w-4/5" />
              <SkBox className="mt-1.5 h-3 w-full" />
            </div>
          </div>
          <SkBox className="mt-2.5 h-9 w-full rounded-lg" />
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Subject card (Favorites/Bookmarks/Semester detail) ---------------- */

export function SkSubjectCard() {
  return (
    <div className="h-full rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SkBox className="h-6 w-16 rounded-md" />
            <SkBox className="h-6 w-20 rounded-md" />
          </div>
          <SkBox className="mt-2.5 h-5 w-4/5" />
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <SkCircle className="size-8" />
          <SkCircle className="size-8" />
        </div>
      </div>
      <SkBox className="mt-2 h-4 w-full" />
      <SkBox className="mt-1.5 h-4 w-2/3" />
      <div className="mt-4 flex items-center justify-between">
        <SkBox className="h-4 w-24" />
        <SkBox className="size-4" />
      </div>
    </div>
  );
}

export function SkSubjectGrid({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cx("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {range(count).map((i) => (
        <SkSubjectCard key={i} />
      ))}
    </div>
  );
}

/* ---------------- Semester card (2-per-row mobile, 4-col desktop) ---------------- */

export function SkSemesterCard() {
  return (
    <div className="flex h-full min-h-[148px] flex-col rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <SkBox className="size-8 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <SkBox className="h-4 w-24" />
            <SkBox className="mt-1 h-3 w-16" />
          </div>
        </div>
        <SkBox className="h-6 w-16 shrink-0 rounded-full" />
      </div>
      <SkBox className="mt-2.5 h-8 w-full" />
      <div className="mt-auto flex items-center gap-3 pt-3">
        <SkBox className="h-4 w-20" />
        <SkBox className="h-4 w-24" />
      </div>
    </div>
  );
}

export function SkSemesterGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid auto-rows-fr grid-cols-2 gap-3 lg:grid-cols-4">
      {range(count).map((i) => (
        <SkSemesterCard key={i} />
      ))}
    </div>
  );
}

/* ---------------- Bookmark card ---------------- */

export function SkBookmarkCard() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 sm:p-5">
      {/* Mobile compact row */}
      <div className="sm:hidden">
        <div className="flex items-center gap-2.5">
          <SkBox className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <SkBox className="h-4 w-4/5" />
            <SkBox className="mt-1.5 h-3 w-3/5" />
          </div>
          <SkCircle className="size-8 shrink-0" />
        </div>
        <SkBox className="mt-2.5 h-9 w-full rounded-lg" />
      </div>
      {/* Desktop body */}
      <div className="hidden flex-1 flex-col sm:flex">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <SkBox className="size-10 shrink-0 rounded-lg" />
            <SkBox className="h-6 w-24 rounded-full" />
          </div>
          <SkCircle className="size-8" />
        </div>
        <div className="mt-3 flex-1">
          <SkBox className="h-4 w-full" />
          <SkBox className="mt-1.5 h-4 w-2/3" />
          <SkBox className="mt-1.5 h-3 w-1/2" />
        </div>
        <div className="mt-3 flex gap-1.5">
          <SkBox className="h-5 w-14 rounded-md" />
          <SkBox className="h-5 w-16 rounded-md" />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
          <SkBox className="h-3.5 w-28" />
          <SkBox className="h-8 w-20 shrink-0 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Download card ---------------- */

export function SkDownloadCard() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 sm:p-5">
      {/* Mobile compact row */}
      <div className="sm:hidden">
        <div className="flex items-center gap-2.5">
          <SkBox className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <SkBox className="h-4 w-4/5" />
            <SkBox className="mt-1.5 h-3 w-3/5" />
            <SkBox className="mt-1 h-3 w-2/5" />
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <SkCircle className="size-8" />
            <SkCircle className="size-8" />
            <SkCircle className="size-8" />
          </div>
        </div>
        <SkBox className="mt-2.5 h-9 w-full rounded-lg" />
      </div>
      {/* Desktop body */}
      <div className="hidden flex-1 flex-col sm:flex">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <SkBox className="size-10 shrink-0 rounded-lg" />
            <SkBox className="h-6 w-24 rounded-full" />
          </div>
          <SkCircle className="size-8" />
        </div>
        <div className="mt-3 flex-1">
          <SkBox className="h-4 w-full" />
          <SkBox className="mt-1.5 h-4 w-2/3" />
          <SkBox className="mt-1.5 h-3 w-1/2" />
        </div>
        <div className="mt-3 flex gap-1.5">
          <SkBox className="h-5 w-14 rounded-md" />
          <SkBox className="h-5 w-16 rounded-md" />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
          <SkBox className="h-3.5 w-28" />
          <SkBox className="h-8 w-20 shrink-0 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Notice rows ---------------- */

export function SkNoticeList({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <SkBox className="h-4 w-48 max-w-full" />
      </div>
      {range(count).map((i) => (
        <div key={i} className="flex items-start gap-3 p-4">
          <SkBox className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <SkBox className="h-5 w-16 rounded-full" />
              <SkBox className="h-5 w-20 rounded-full" />
            </div>
            <SkBox className="mt-1.5 h-4 w-4/5" />
            <SkBox className="mt-1 h-3 w-2/5" />
            <SkBox className="mt-1 h-3.5 w-full" />
          </div>
          <div className="shrink-0">
            <SkBox className="ml-auto h-3.5 w-16" />
            <SkBox className="ml-auto mt-1 h-3.5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Downloads history banner ---------------- */

export function SkDownloadBanner() {
  return (
    <div className="mb-4 rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <SkBox className="size-10 shrink-0 rounded-xl" />
        <SkBox className="h-5 w-40 max-w-full" />
      </div>
      <SkBox className="mt-3 h-8 w-56 max-w-full" />
      <div className="mt-3">
        <SkBox className="h-2 w-full rounded-full" />
        <div className="mt-2 flex items-center justify-between">
          <SkBox className="h-3.5 w-32" />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Subject header (SubjectDetail hero) ---------------- */

export function SkSubjectHeader() {
  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <SkBox className="h-4 w-56 max-w-full" />
          <SkBox className="mt-2 h-8 w-72 max-w-full" />
          <SkBox className="mt-2 h-4 w-full max-w-2xl" />
          <div className="mt-4 flex flex-wrap gap-2">
            <SkBox className="h-9 w-24 rounded-lg" />
            <SkBox className="h-9 w-24 rounded-lg" />
            <SkBox className="h-9 w-24 rounded-lg" />
            <SkBox className="h-9 w-24 rounded-lg" />
            <SkBox className="h-9 w-24 rounded-lg" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SkBox className="h-10 w-28 rounded-lg" />
          <SkBox className="h-10 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Dashboard stat mini (4-in-a-row) ---------------- */

export function SkStatMini() {
  return (
    <div className="flex h-full min-w-0 flex-col items-center rounded-xl border border-border bg-surface p-2 text-center sm:p-4">
      <SkBox className="size-7 shrink-0 rounded-lg sm:size-8" />
      <SkBox className="mt-1.5 h-2.5 w-3/4 sm:mt-2" />
      <SkBox className="mt-1 h-5 w-1/2 sm:h-6" />
      <SkBox className="mt-1 h-2.5 w-4/5" />
    </div>
  );
}

/* ---------------- Dashboard continue-reading hero ---------------- */

export function SkContinueCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <SkBox className="h-3 w-24" />
          <SkBox className="mt-2 h-5 w-4/5" />
          <SkBox className="mt-1.5 h-3.5 w-1/3" />
        </div>
        <SkBox className="size-10 shrink-0 rounded-xl" />
      </div>
      <SkBox className="mt-2.5 h-4 w-full" />
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <SkBox className="h-3.5 w-28" />
          <SkBox className="h-3.5 w-20" />
        </div>
        <SkBox className="mt-1.5 h-1.5 w-full rounded-full" />
      </div>
      <div className="mt-4 flex items-center gap-2.5">
        <SkBox className="h-10 flex-1 rounded-lg" />
        <SkBox className="h-10 w-24 shrink-0 rounded-lg" />
      </div>
    </div>
  );
}

/* ---------------- Dashboard recent / trending rows ---------------- */

export function SkRecentCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <SkBox className="h-5 w-24 rounded-full" />
          <SkBox className="mt-1.5 h-4 w-4/5" />
          <SkBox className="mt-1 h-3.5 w-full" />
        </div>
        <SkBox className="size-9 shrink-0 rounded-lg" />
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <SkBox className="h-3 w-16" />
          <SkBox className="h-3 w-10" />
        </div>
        <SkBox className="mt-1 h-1.5 w-full rounded-full" />
      </div>
    </div>
  );
}

export function SkTrendingCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <SkBox className="size-9 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <SkBox className="h-4 w-4/5" />
          <SkBox className="mt-1.5 h-3 w-full" />
          <SkBox className="mt-1 h-3 w-2/5" />
        </div>
        <SkCircle className="size-8 shrink-0" />
      </div>
    </div>
  );
}

export function SkQuickPills() {
  return (
    <div className="flex gap-2 overflow-x-auto" aria-hidden="true">
      <SkBox className="h-9 w-28 shrink-0 rounded-full" />
      <SkBox className="h-9 w-32 shrink-0 rounded-full" />
      <SkBox className="h-9 w-32 shrink-0 rounded-full" />
    </div>
  );
}
