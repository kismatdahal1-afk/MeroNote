import type { ReactNode } from "react";
import { cx } from "../../lib/utils";

/**
 * Low-level skeleton primitives. Soft neutral surfaces with the existing
 * pulse animation and matching rounded corners — composed into
 * page-specific skeletons, never used as generic page fallbacks.
 */

/** Base pulsing placeholder block. */
export function SkBox({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx("animate-pulse rounded-lg bg-surface-muted", className)}
    />
  );
}

/** Short text-line placeholder. */
export function SkText({ className }: { className?: string }) {
  return <SkBox className={cx("h-3 rounded-md", className)} />;
}

/** Circular placeholder (icon buttons, badges). */
export function SkCircle({ className }: { className?: string }) {
  return <SkBox className={cx("rounded-full", className)} />;
}

/** Page-level loading landmark (announced once by screen readers). */
export function SkPage({
  label = "Loading content",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-label={label}>
      {children}
    </div>
  );
}

/** Standard PageHeader placeholder (title + subtitle). */
export function SkPageHeader() {
  return (
    <div className="mb-6">
      <SkBox className="h-8 w-48 max-w-full" />
      <SkBox className="mt-2 h-4 w-72 max-w-full" />
    </div>
  );
}

/** Search bar placeholder (max-w-xl pill, h-10). */
export function SkSearch() {
  return <SkBox className="mb-5 h-10 w-full max-w-xl rounded-full" />;
}

/**
 * Filter selects (responsive 2-col grid → single row) + type chips row.
 * Mirrors the Resources/Favorites/Bookmarks/Downloads filter block.
 */
export function SkFilters() {
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:flex sm:flex-nowrap">
        <SkBox className="h-10 w-full sm:w-48" />
        <SkBox className="h-10 w-full sm:w-48 sm:order-last" />
        <SkBox className="col-span-2 h-10 w-full sm:col-span-1 sm:w-56" />
      </div>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-hidden="true">
        <SkBox className="h-8 w-20 shrink-0 rounded-full" />
        <SkBox className="h-8 w-24 shrink-0 rounded-full" />
        <SkBox className="h-8 w-28 shrink-0 rounded-full" />
        <SkBox className="h-8 w-24 shrink-0 rounded-full" />
        <SkBox className="h-8 w-28 shrink-0 rounded-full" />
      </div>
    </>
  );
}

/** Section heading placeholder. */
export function SkSectionTitle({ className }: { className?: string }) {
  return <SkBox className={cx("mb-3 h-5 w-40 max-w-full", className)} />;
}

/** Back-button + breadcrumb placeholder. */
export function SkBackRow() {
  return (
    <>
      <div className="mb-1 -ml-1">
        <SkBox className="h-10 w-10 rounded-lg" />
      </div>
      <SkBox className="mb-2 h-4 w-64 max-w-full" />
    </>
  );
}
