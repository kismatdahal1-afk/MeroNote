import type { ReactNode } from "react";
import { cx } from "../../lib/utils";
import { SkBox, SkCircle, SkPage } from "./primitives";
import { ResourceDetailSkeleton } from "./pages";

/**
 * Admin Portal loading skeletons. Built from the same primitives as the
 * student skeletons, mirroring each admin page's real responsive layout
 * (desktop tables + mobile cards). Shown only as route Suspense fallbacks
 * while the page chunk loads.
 */

function range(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

/* ---------------- Shared admin pieces ---------------- */

/** StatCard row (icon + label/value/hint). */
export function SkAdminStats({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cx("grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4", className)}>
      {range(count).map((i) => (
        <div key={i} className="flex h-full items-center rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="flex w-full items-center gap-4">
            <SkBox className="size-10 shrink-0 rounded-lg sm:size-11" />
            <div className="min-w-0 flex-1">
              <SkBox className="h-2.5 w-3/4" />
              <SkBox className="mt-1.5 h-5 w-1/2 sm:h-6" />
              <SkBox className="mt-1 h-3 w-4/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Admin breadcrumb (Admin → Section). */
export function SkAdminCrumb({ width = "w-40" }: { width?: string }) {
  return (
    <div className="flex items-center gap-1 text-xs font-medium" aria-hidden="true">
      <SkBox className="h-4 w-14" />
      <SkBox className="size-3" />
      <SkBox className={cx("h-4", width)} />
    </div>
  );
}

/** Admin management table (desktop md+). Columns carry widths + cell shapes. */
export function SkAdminTable({
  columns,
  rows = 5,
}: {
  columns: { width?: string; cell: ReactNode }[];
  rows?: number;
}) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted">
              {columns.map((c, i) => (
                <th key={i} scope="col" className={cx("px-4 py-3", c.width)}>
                  <SkBox className="h-3.5 w-3/4" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {range(rows).map((r) => (
              <tr key={r}>
                {columns.map((c, i) => (
                  <td key={i} className={cx("px-4 py-3.5", c.width)}>
                    {c.cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Resource cell (icon + title) shared by resource tables. */
export function SkTableResource() {
  return (
    <div className="flex items-center gap-3">
      <SkBox className="size-9 shrink-0 rounded-lg" />
      <SkBox className="h-4 min-w-0 flex-1" />
    </div>
  );
}

/** Right-aligned action cell (buttons + icon buttons). */
export function SkTableActions({ buttons = 0 }: { buttons?: number }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {range(buttons).map((i) => (
        <SkBox key={i} className="h-8 w-20 rounded-lg" />
      ))}
      <SkCircle className="size-8" />
      <SkCircle className="size-8" />
    </div>
  );
}

/* ---------------- Admin Dashboard ---------------- */

export function AdminDashboardSkeleton() {
  return (
    <SkPage label="Loading admin dashboard">
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SkBox className="h-8 w-56 max-w-full" />
            <SkBox className="mt-2 h-4 w-72 max-w-full" />
          </div>
          <SkBox className="h-6 w-20 shrink-0 rounded-full" />
        </div>
      </div>
      <SkAdminStats className="xl:grid-cols-4" />
      <section className="mt-8" aria-label="Quick actions">
        <SkBox className="mb-3.5 h-6 w-40" />
        <div className="grid auto-rows-fr grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4 lg:gap-5 xl:gap-6">
          {range(4).map((i) => (
            <div
              key={i}
              className="flex h-full min-h-[112px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface p-5 text-center sm:min-h-[118px] lg:min-h-[132px]"
            >
              <SkBox className="size-12 rounded-lg" />
              <SkBox className="h-3.5 w-24 max-w-full" />
            </div>
          ))}
        </div>
      </section>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {[0, 1].map((s) => (
          <section key={s} aria-label="Admin list">
            <div className="mb-3.5 flex items-center justify-between">
              <SkBox className="h-6 w-40" />
              <SkBox className="h-4 w-20" />
            </div>
            <div className="divide-y divide-border rounded-xl border border-border bg-surface">
              {range(4).map((i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <SkBox className="size-8 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <SkBox className="h-4 w-4/5" />
                    <SkBox className="mt-1 h-3 w-3/5" />
                  </div>
                  <SkBox className="h-3.5 w-16 shrink-0" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </SkPage>
  );
}

/* ---------------- Admin Notices ---------------- */

const noticeRowCell = (
  <>
    <SkBox className="h-4 w-4/5" />
    <SkBox className="mt-1 h-3 w-3/5" />
    <SkBox className="mt-1 h-3 w-2/5" />
  </>
);

export function AdminNoticesSkeleton() {
  return (
    <SkPage label="Loading notices">
      <div className="mb-6">
        <SkAdminCrumb width="w-24" />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <SkBox className="h-8 w-40 max-w-full" />
            <SkBox className="mt-2 h-4 w-72 max-w-full" />
          </div>
          <SkBox className="h-10 w-32 shrink-0 rounded-lg" />
        </div>
      </div>
      <div className="mb-5">
        <div className="relative mb-3 max-w-md">
          <SkBox className="h-10 w-full rounded-lg" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-hidden="true">
          <SkBox className="h-8 w-16 shrink-0 rounded-full" />
          <SkBox className="h-8 w-20 shrink-0 rounded-full" />
          <SkBox className="h-8 w-24 shrink-0 rounded-full" />
          <SkBox className="h-8 w-24 shrink-0 rounded-full" />
          <SkBox className="h-8 w-20 shrink-0 rounded-full" />
        </div>
      </div>
      <SkAdminTable
        columns={[
          { cell: noticeRowCell },
          { cell: <><SkBox className="h-6 w-16 rounded-full" /><SkBox className="mt-1 h-5 w-20 rounded-full" /></> },
          { cell: <><SkBox className="h-4 w-20" /><SkBox className="mt-1 h-3 w-24" /></> },
          { cell: <SkBox className="h-6 w-20 rounded-full" /> },
          { cell: <SkTableActions /> },
        ]}
      />
      {/* Mobile row-cards */}
      <div className="space-y-3 md:hidden">
        {range(3).map((i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4">
            <SkBox className="h-4 w-4/5" />
            <SkBox className="mt-1.5 h-3.5 w-full" />
            <SkBox className="mt-1 h-3 w-2/5" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SkBox className="h-6 w-16 rounded-full" />
              <SkBox className="h-6 w-24 rounded-full" />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <SkBox className="h-6 w-20 rounded-full" />
              <div className="flex gap-1">
                <SkCircle className="size-8" />
                <SkCircle className="size-8" />
                <SkCircle className="size-8" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </SkPage>
  );
}

/* ---------------- Admin Semesters ---------------- */

function SkAdminSubjectCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex w-full flex-col items-start gap-3 p-4">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <SkBox className="h-6 w-14 rounded-md" />
            <SkBox className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex items-center gap-1">
            <SkCircle className="size-8" />
            <SkCircle className="size-8" />
          </div>
        </div>
        <SkBox className="h-5 w-3/4" />
        <SkBox className="h-8 w-full" />
        <div className="flex flex-wrap items-center gap-1.5">
          <SkBox className="h-3.5 w-20" />
          <SkBox className="size-1 rounded-full" />
          <SkBox className="h-3.5 w-12" />
        </div>
      </div>
    </div>
  );
}

export function AdminSemestersSkeleton() {
  return (
    <SkPage label="Loading semesters">
      <div className="space-y-6">
        <div className="flex items-center gap-1" aria-hidden="true">
          <SkBox className="h-4 w-14" />
          <SkBox className="size-3" />
          <SkBox className="h-4 w-24" />
        </div>
        <div>
          <SkBox className="h-8 w-48 max-w-full" />
          <SkBox className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <SkAdminStats />
        {[0, 1].map((s) => (
          <section key={s} className="space-y-3" aria-label="Semester section">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
              <div className="flex items-center gap-2">
                <SkBox className="size-5" />
                <SkBox className="h-6 w-40" />
              </div>
              <div className="flex items-center gap-2">
                <SkBox className="h-8 w-28 rounded-lg" />
                <SkBox className="h-8 w-32 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <SkAdminSubjectCard />
              <SkAdminSubjectCard />
            </div>
          </section>
        ))}
      </div>
    </SkPage>
  );
}

/* ---------------- Admin Resources ---------------- */

export function AdminResourcesSkeleton() {
  return (
    <SkPage label="Loading resources">
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SkBox className="h-8 w-56 max-w-full" />
            <SkBox className="mt-2 h-4 w-80 max-w-full" />
          </div>
          <SkBox className="h-10 w-36 shrink-0 rounded-lg" />
        </div>
      </div>
      <SkAdminStats />
      <div className="mb-5 mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SkBox className="h-10 w-full rounded-lg sm:max-w-md sm:flex-1" />
        <div className="flex gap-3">
          <SkBox className="h-10 min-w-0 flex-1 rounded-lg sm:w-44 sm:flex-none" />
          <SkBox className="h-10 min-w-0 flex-1 rounded-lg sm:w-44 sm:flex-none" />
        </div>
      </div>
      <SkAdminTable
        columns={[
          { width: "w-[25%]", cell: <SkTableResource /> },
          {
            width: "w-[17%]",
            cell: (
              <>
                <SkBox className="h-3.5 w-4/5" />
                <SkBox className="mt-1 h-3 w-3/5" />
              </>
            ),
          },
          { width: "w-[12%]", cell: <SkBox className="h-6 w-20 rounded-full" /> },
          {
            width: "w-[11%]",
            cell: (
              <>
                <SkBox className="h-4 w-16" />
                <SkBox className="mt-1 h-3 w-14" />
              </>
            ),
          },
          { width: "w-[11%]", cell: <SkBox className="h-6 w-20 rounded-full" /> },
          {
            width: "w-[11%]",
            cell: (
              <>
                <SkBox className="h-3.5 w-16" />
                <SkBox className="mt-1 h-3 w-14" />
              </>
            ),
          },
          { width: "w-[13%]", cell: <SkTableActions /> },
        ]}
      />
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {range(4).map((i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <SkBox className="size-10 shrink-0 rounded-lg" />
                <div className="min-w-0">
                  <SkBox className="h-4 w-32" />
                  <SkBox className="mt-1 h-3 w-40 max-w-full" />
                </div>
              </div>
              <SkBox className="h-6 w-16 shrink-0 rounded-full" />
            </div>
            <div className="mt-2.5 flex items-center gap-2.5">
              <SkBox className="size-8 shrink-0 rounded-lg" />
              <SkBox className="h-4 min-w-0 flex-1" />
              <div className="flex shrink-0 items-center gap-0.5">
                <SkCircle className="size-8" />
                <SkCircle className="size-8" />
              </div>
            </div>
            <SkBox className="mt-2.5 h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </SkPage>
  );
}

/* ---------------- Admin Drafts ---------------- */

export function AdminDraftsSkeleton() {
  return (
    <SkPage label="Loading drafts">
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SkBox className="h-8 w-40 max-w-full" />
            <SkBox className="mt-2 h-4 w-80 max-w-full" />
          </div>
          <SkBox className="h-6 w-24 shrink-0 rounded-full" />
        </div>
      </div>
      <SkAdminStats />
      <div className="mb-5 mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SkBox className="h-10 w-full rounded-lg sm:max-w-md sm:flex-1" />
        <div className="flex gap-3">
          <SkBox className="h-10 min-w-0 flex-1 rounded-lg sm:w-44 sm:flex-none" />
          <SkBox className="h-10 min-w-0 flex-1 rounded-lg sm:w-44 sm:flex-none" />
        </div>
      </div>
      <SkAdminTable
        columns={[
          { width: "w-[29%]", cell: <SkTableResource /> },
          { width: "w-[16%]", cell: <SkBox className="h-6 w-20 rounded-full" /> },
          { width: "w-[11%]", cell: <SkBox className="h-4 w-16" /> },
          { width: "w-[14%]", cell: <SkBox className="h-4 w-20" /> },
          { width: "w-[11%]", cell: <SkBox className="h-4 w-16" /> },
          { width: "w-[19%]", cell: <SkTableActions buttons={1} /> },
        ]}
      />
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {range(4).map((i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <SkBox className="size-10 shrink-0 rounded-lg" />
                <div className="min-w-0">
                  <SkBox className="h-4 w-36 max-w-full" />
                  <SkBox className="mt-1 h-3 w-44 max-w-full" />
                </div>
              </div>
              <SkBox className="h-6 w-16 shrink-0 rounded-full" />
            </div>
            <SkBox className="mt-2 h-3.5 w-full" />
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
              <SkBox className="h-8 w-24 rounded-lg" />
              <div className="flex gap-1">
                <SkCircle className="size-8" />
                <SkCircle className="size-8" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </SkPage>
  );
}

/* ---------------- Admin Trash ---------------- */

export function AdminTrashSkeleton() {
  return (
    <SkPage label="Loading trash">
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SkBox className="h-8 w-32 max-w-full" />
            <SkBox className="mt-2 h-4 w-72 max-w-full" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SkBox className="h-9 w-28 rounded-lg" />
            <SkBox className="h-9 w-28 rounded-lg" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
          <SkBox className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <SkBox className="h-3 w-3/4" />
            <SkBox className="mt-1.5 h-5 w-1/3" />
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
          <SkBox className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <SkBox className="h-3 w-3/4" />
            <SkBox className="mt-1.5 h-5 w-1/3" />
          </div>
        </div>
      </div>
      <div className="mb-5 mt-5 flex gap-2 overflow-x-auto pb-1" aria-hidden="true">
        <SkBox className="h-8 w-20 shrink-0 rounded-full" />
        <SkBox className="h-8 w-24 shrink-0 rounded-full" />
        <SkBox className="h-8 w-24 shrink-0 rounded-full" />
        <SkBox className="h-8 w-20 shrink-0 rounded-full" />
      </div>
      <SkAdminTable
        columns={[
          { width: "w-[25%]", cell: <SkTableResource /> },
          {
            width: "w-[17%]",
            cell: (
              <>
                <SkBox className="h-3.5 w-4/5" />
                <SkBox className="mt-1 h-3 w-3/5" />
              </>
            ),
          },
          { width: "w-[12%]", cell: <SkBox className="h-6 w-20 rounded-full" /> },
          { width: "w-[11%]", cell: <SkBox className="h-4 w-16" /> },
          { width: "w-[11%]", cell: <SkBox className="h-6 w-20 rounded-full" /> },
          {
            width: "w-[11%]",
            cell: (
              <>
                <SkBox className="h-3.5 w-16" />
                <SkBox className="mt-1 h-3 w-14" />
              </>
            ),
          },
          { width: "w-[13%]", cell: <SkTableActions buttons={1} /> },
        ]}
      />
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {range(4).map((i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <SkBox className="size-10 shrink-0 rounded-lg" />
                <div className="min-w-0">
                  <SkBox className="h-4 w-32" />
                  <SkBox className="mt-1 h-3 w-40 max-w-full" />
                </div>
              </div>
              <SkBox className="h-6 w-16 shrink-0 rounded-full" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SkBox className="h-7 w-20 rounded-full" />
              <SkBox className="h-7 w-24 rounded-full" />
              <SkBox className="h-7 w-24 rounded-full" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
              <SkBox className="h-8 w-24 rounded-lg" />
              <SkCircle className="size-8" />
            </div>
          </div>
        ))}
      </div>
    </SkPage>
  );
}

/* ---------------- Admin Settings ---------------- */

function SkSettingsRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 divide-y divide-border">
      {range(rows).map((i) => (
        <div key={i} className="flex items-center justify-between gap-3 pt-3 first:pt-0">
          <div className="min-w-0 flex-1">
            <SkBox className="h-4 w-48 max-w-full" />
            <SkBox className="mt-1.5 h-3 w-64 max-w-full" />
          </div>
          <SkBox className="h-8 w-40 max-w-[45%] shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function AdminSettingsSkeleton() {
  return (
    <SkPage label="Loading settings">
      <div className="mb-6">
        <SkBox className="h-8 w-40 max-w-full" />
        <SkBox className="mt-2 h-4 w-80 max-w-full" />
      </div>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-xl border border-border bg-surface p-6 sm:p-8">
          <div className="flex flex-row items-center gap-4 sm:gap-6">
            <SkCircle className="size-20 shrink-0 sm:size-24" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SkBox className="h-6 w-40 max-w-full" />
                <SkBox className="h-5 w-16 rounded-full" />
              </div>
              <SkBox className="mt-2 h-4 w-56 max-w-full" />
              <SkBox className="mt-1.5 h-3 w-44 max-w-full" />
              <SkBox className="mt-4 h-8 w-28 rounded-lg" />
            </div>
          </div>
        </div>
        {[0, 1].map((s) => (
          <section key={s}>
            <div className="mb-3 px-1">
              <SkBox className="h-5 w-44 max-w-full" />
              <SkBox className="ml-[28px] mt-1.5 h-4 w-64 max-w-full" />
            </div>
            <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
              <SkSettingsRows rows={s === 0 ? 5 : 3} />
            </div>
          </section>
        ))}
      </div>
    </SkPage>
  );
}

/* ---------------- Admin resource detail (strip + shared detail) ---------------- */

export function AdminResourceDetailSkeleton() {
  return <ResourceDetailSkeleton adminStrip />;
}
