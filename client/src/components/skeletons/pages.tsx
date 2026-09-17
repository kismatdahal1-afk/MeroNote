import { SkBox, SkCircle, SkFilters, SkPage, SkPageHeader, SkSearch, SkSectionTitle, SkBackRow } from "./primitives";
import {
  SkBookmarkCard,
  SkContinueCard,
  SkDownloadBanner,
  SkDownloadCard,
  SkNoticeList,
  SkQuickPills,
  SkRecentCard,
  SkResourceCard,
  SkResourceGrid,
  SkRowList,
  SkSemesterGrid,
  SkStatMini,
  SkSubjectGrid,
  SkSubjectHeader,
  SkTrendingCard,
} from "./cards";

/**
 * Page-specific loading skeletons. Each mirrors its page's real responsive
 * layout (grids, breakpoints, mobile rows) so content swaps in without
 * layout shift. Shown only as route Suspense fallbacks while the page
 * chunk loads — never on timers, never after content arrives.
 */

/* ---------------- Dashboard ---------------- */

export function DashboardSkeleton() {
  return (
    <SkPage label="Loading dashboard">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <SkBox className="h-8 w-40 max-w-full" />
          <SkBox className="mt-1 h-8 w-32 max-w-full" />
          <SkBox className="mt-2 h-4 w-64 max-w-full" />
        </div>
      </header>
      <div className="mb-3.5">
        <SkBox className="h-7 w-64 max-w-full" />
        <SkBox className="mt-2 h-4 w-full max-w-2xl" />
      </div>
      <div className="mb-3.5">
        <SkNoticeList count={2} />
      </div>
      <div className="mb-6 flex gap-2.5">
        <SkBox className="h-10 min-w-0 flex-1 rounded-xl" />
        <SkBox className="h-10 w-11 shrink-0 rounded-xl" />
      </div>
      <section aria-label="Study summary" className="mb-7">
        <div className="grid auto-rows-fr grid-cols-4 gap-2 sm:gap-3">
          <SkStatMini />
          <SkStatMini />
          <SkStatMini />
          <SkStatMini />
        </div>
      </section>
      <section aria-label="Continue reading" className="mb-7">
        <div className="mb-3 flex items-center justify-between gap-2">
          <SkBox className="h-5 w-40" />
          <SkBox className="h-4 w-24" />
        </div>
        <SkContinueCard />
      </section>
      <section aria-label="Quick navigation" className="mb-7">
        <SkQuickPills />
      </section>
      <section aria-label="Recently opened" className="mb-7">
        <div className="mb-3 flex items-center justify-between gap-2">
          <SkBox className="h-5 w-40" />
          <SkBox className="h-4 w-16" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <SkRecentCard />
          <SkRecentCard />
        </div>
      </section>
      <section aria-label="Recently added and trending" className="mb-2">
        <div className="mb-3 flex items-center justify-between gap-2">
          <SkBox className="h-5 w-56 max-w-full" />
          <SkBox className="h-4 w-16" />
        </div>
        <div className="mb-3 flex justify-end">
          <SkBox className="h-6 w-28 rounded-full" />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <SkTrendingCard />
          <SkTrendingCard />
          <SkTrendingCard />
        </div>
      </section>
    </SkPage>
  );
}

/* ---------------- Semesters (library list) ---------------- */

export function SemestersSkeleton() {
  return (
    <SkPage label="Loading semesters">
      <SkPageHeader />
      {/* Ongoing-semester banner shape */}
      <div className="mb-6 rounded-xl border border-border bg-surface">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <SkCircle className="size-[88px] shrink-0" />
            <div className="min-w-0 flex-1">
              <SkBox className="h-3 w-32" />
              <SkBox className="mt-2 h-7 w-48 max-w-full" />
              <SkBox className="mt-1.5 h-3.5 w-40 max-w-full" />
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[22.5rem] lg:grid-cols-2 xl:grid-cols-4">
            <SkBox className="h-16 rounded-lg" />
            <SkBox className="h-16 rounded-lg" />
            <SkBox className="h-16 rounded-lg" />
            <SkBox className="h-16 rounded-lg" />
          </div>
          <SkBox className="h-12 w-full shrink-0 rounded-lg lg:w-44" />
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-5 py-3.5 sm:flex-row sm:items-end sm:gap-6 sm:px-6">
          <SkBox className="h-9 w-full sm:max-w-52" />
          <SkBox className="h-9 w-full sm:max-w-52" />
          <SkBox className="h-9 w-28 shrink-0 rounded-lg" />
        </div>
      </div>
      <SkSemesterGrid />
    </SkPage>
  );
}

/* ---------------- Semester detail (subjects + resources) ---------------- */

export function SemesterSubjectsSkeleton() {
  return (
    <SkPage label="Loading semester">
      <SkBackRow />
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <SkBox className="h-8 w-48 max-w-full" />
            <SkBox className="mt-2 h-4 w-72 max-w-full" />
          </div>
          <SkBox className="h-9 w-32 shrink-0 rounded-full" />
        </div>
      </div>
      <div className="mb-6 rounded-xl border border-border bg-surface p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <SkBox className="h-16 rounded-lg" />
          <SkBox className="h-16 rounded-lg" />
          <SkBox className="h-16 rounded-lg" />
          <SkBox className="h-16 rounded-lg" />
        </div>
      </div>
      <div className="mb-5 flex gap-2.5">
        <SkBox className="h-10 min-w-0 flex-1 rounded-xl" />
        <SkBox className="h-10 w-11 shrink-0 rounded-xl" />
      </div>
      <SkSectionTitle />
      <SkSubjectGrid count={6} className="mb-7" />
      <SkSectionTitle />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-hidden="true">
        <SkBox className="h-8 w-20 shrink-0 rounded-full" />
        <SkBox className="h-8 w-24 shrink-0 rounded-full" />
        <SkBox className="h-8 w-28 shrink-0 rounded-full" />
        <SkBox className="h-8 w-24 shrink-0 rounded-full" />
      </div>
      <SkRowList count={4} />
      <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <SkResourceCard />
        <SkResourceCard />
        <SkResourceCard />
        <SkResourceCard />
      </div>
    </SkPage>
  );
}

/* ---------------- Subject detail ---------------- */

function SkResourceGroup({ rows = 3 }: { rows?: number }) {
  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center gap-2">
        <SkBox className="size-8 shrink-0 rounded-lg" />
        <SkBox className="h-5 w-40 max-w-full" />
        <SkBox className="h-5 w-8 rounded-full" />
      </div>
      <SkRowList count={rows} />
      <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <SkResourceCard />
        <SkResourceCard />
        <SkResourceCard />
        <SkResourceCard />
      </div>
    </section>
  );
}

export function SubjectDetailSkeleton() {
  return (
    <SkPage label="Loading subject">
      <SkBackRow />
      <SkSubjectHeader />
      <SkResourceGroup rows={3} />
      <SkResourceGroup rows={2} />
    </SkPage>
  );
}

/* ---------------- Resources ---------------- */

export function ResourcesSkeleton() {
  return (
    <SkPage label="Loading resources">
      <SkPageHeader />
      <SkSearch />
      <SkFilters />
      <SkResourceGrid />
    </SkPage>
  );
}

/* ---------------- Notices ---------------- */

export function NoticesSkeleton() {
  return (
    <SkPage label="Loading notices">
      <SkPageHeader />
      <SkSearch />
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-hidden="true">
        <SkBox className="h-8 w-16 shrink-0 rounded-full" />
        <SkBox className="h-8 w-20 shrink-0 rounded-full" />
        <SkBox className="h-8 w-28 shrink-0 rounded-full" />
        <SkBox className="h-8 w-28 shrink-0 rounded-full" />
        <SkBox className="h-8 w-24 shrink-0 rounded-full" />
        <SkBox className="h-8 w-20 shrink-0 rounded-full" />
      </div>
      <SkNoticeList />
    </SkPage>
  );
}

/* ---------------- Favorites (subjects + resources) ---------------- */

export function FavoritesSkeleton() {
  return (
    <SkPage label="Loading favorites">
      <SkPageHeader />
      <SkSearch />
      <SkFilters />
      <section className="mb-8" aria-label="Subjects">
        <SkSectionTitle />
        <SkSubjectGrid count={3} />
      </section>
      <section aria-label="Resources">
        <SkSectionTitle />
        <SkResourceGrid count={4} />
      </section>
    </SkPage>
  );
}

/* ---------------- Bookmarks (subjects + pages) ---------------- */

export function BookmarksSkeleton() {
  return (
    <SkPage label="Loading bookmarks">
      <SkPageHeader />
      <SkSearch />
      <SkFilters />
      <section className="mb-8" aria-label="Subjects">
        <SkSectionTitle />
        <SkSubjectGrid count={3} />
      </section>
      <section aria-label="Saved pages">
        <SkSectionTitle />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SkBookmarkCard />
          <SkBookmarkCard />
          <SkBookmarkCard />
          <SkBookmarkCard />
        </div>
      </section>
    </SkPage>
  );
}

/* ---------------- Downloads ---------------- */

export function DownloadsSkeleton() {
  return (
    <SkPage label="Loading downloads">
      <SkPageHeader />
      <SkDownloadBanner />
      <SkFilters />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SkDownloadCard />
        <SkDownloadCard />
        <SkDownloadCard />
        <SkDownloadCard />
      </div>
    </SkPage>
  );
}

/* ---------------- Resource detail ---------------- */

export function ResourceDetailSkeleton({ adminStrip = false }: { adminStrip?: boolean }) {
  return (
    <SkPage label="Loading resource">
      <SkBackRow />
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <SkBox className="h-8 w-72 max-w-full" />
            <SkBox className="mt-2 h-4 w-full max-w-xl" />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <SkCircle className="size-10" />
            <SkCircle className="size-10" />
            <SkBox className="h-10 w-28 rounded-lg" />
            <SkBox className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </div>
      {adminStrip && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <SkBox className="h-6 w-20 rounded-full" />
              <SkBox className="h-6 w-24 rounded-full" />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <SkBox className="h-8 w-20 rounded-lg" />
              <SkBox className="h-8 w-20 rounded-lg" />
              <SkBox className="h-8 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-6 lg:col-span-2">
          <SkBox className="h-5 w-24" />
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-8">
            <div>
              <SkBox className="h-3 w-20" />
              <SkBox className="mt-2 h-6 w-28 rounded-full" />
            </div>
            <div>
              <SkBox className="h-3 w-20" />
              <SkBox className="mt-2 h-4 w-32" />
            </div>
            <div>
              <SkBox className="h-3 w-20" />
              <SkBox className="mt-2 h-4 w-28" />
            </div>
            <div>
              <SkBox className="h-3 w-20" />
              <SkBox className="mt-2 h-4 w-16" />
            </div>
            <div>
              <SkBox className="h-3 w-20" />
              <SkBox className="mt-2 h-4 w-20" />
            </div>
            <div>
              <SkBox className="h-3 w-20" />
              <SkBox className="mt-2 h-4 w-24" />
            </div>
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <SkBox className="h-3 w-16" />
            <div className="mt-2 flex flex-wrap gap-2">
              <SkBox className="h-6 w-16 rounded-md" />
              <SkBox className="h-6 w-20 rounded-md" />
              <SkBox className="h-6 w-14 rounded-md" />
            </div>
          </div>
        </div>
        <div className="h-fit rounded-xl border border-border bg-surface p-5">
          <SkBox className="h-4 w-24" />
          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <SkBox className="h-3.5 w-16" />
              <SkBox className="h-3.5 w-24" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <SkBox className="h-3.5 w-16" />
              <SkBox className="h-3.5 w-20" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <SkBox className="h-3.5 w-16" />
              <SkBox className="h-6 w-20 rounded-full" />
            </div>
          </div>
          <SkBox className="mt-5 h-10 w-full rounded-lg" />
        </div>
      </div>
    </SkPage>
  );
}

/* ---------------- PDF viewer ---------------- */

export function ReaderSkeleton() {
  return (
    <SkPage label="Loading document viewer">
      <div aria-hidden="true">
        {/* Compact breadcrumb row */}
        <div className="flex min-h-[1.5rem] flex-wrap items-center gap-0.5 border-b border-border bg-background px-3 py-0.5">
          <SkBox className="h-3 w-16" />
          <SkBox className="h-3 w-24" />
          <SkBox className="h-3 w-32" />
        </div>
        {/* Desktop toolbar */}
        <div className="hidden items-center gap-2 border-b border-border px-3 md:flex lg:px-4 h-14">
          <SkBox className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <SkBox className="h-4 w-64 max-w-full" />
            <SkBox className="mt-1 h-3 w-40 max-w-full" />
          </div>
          <SkBox className="h-9 w-32 shrink-0 rounded-lg" />
          <SkCircle className="size-10 shrink-0" />
          <SkCircle className="size-10 shrink-0" />
          <SkCircle className="size-10 shrink-0" />
        </div>
        {/* Mobile title + controls rows */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-1 md:hidden">
          <SkBox className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <SkBox className="h-4 w-3/4" />
            <SkBox className="mt-1 h-3 w-1/2" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-1 md:hidden">
          <SkBox className="h-7 w-28 shrink-0 rounded-md" />
          <SkBox className="h-7 w-14 shrink-0 rounded-md" />
          <SkCircle className="size-8 shrink-0" />
          <SkCircle className="size-8 shrink-0" />
          <SkCircle className="size-8 shrink-0" />
        </div>
        {/* Document area */}
        <div className="flex justify-center bg-background px-4 py-6 lg:py-10">
          <SkBox className="aspect-[210/297] w-full max-w-[56rem] rounded-xl border border-border bg-surface shadow-card" />
        </div>
      </div>
    </SkPage>
  );
}

/* ---------------- Settings ---------------- */

export function SettingsSkeleton() {
  return (
    <SkPage label="Loading settings">
      <SkPageHeader />
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-surface p-5">
        <SkCircle className="size-16 shrink-0 sm:size-20" />
        <div className="min-w-0 flex-1">
          <SkBox className="h-5 w-40 max-w-full" />
          <SkBox className="mt-1.5 h-3.5 w-56 max-w-full" />
        </div>
        <SkBox className="h-9 w-24 shrink-0 rounded-lg" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <SkBox className="h-5 w-32" />
          <div className="mt-4 space-y-3">
            <SkBox className="h-10 w-full rounded-lg" />
            <SkBox className="h-10 w-full rounded-lg" />
            <SkBox className="h-10 w-full rounded-lg" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <SkBox className="h-5 w-40 max-w-full" />
          <div className="mt-4 space-y-3">
            <SkBox className="h-10 w-full rounded-lg" />
            <SkBox className="h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </SkPage>
  );
}
