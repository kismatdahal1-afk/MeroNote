import { Link } from "react-router-dom";
import {
  LibraryBig, GraduationCap, Bell, Star, Clock, Upload, BookOpen,
} from "lucide-react";

import { PageHeader, Card, StatCard } from "../../components/common/PageHeader";
import { Badge } from "../../components/common/Badge";
import { ErrorState } from "../../components/common/States";
import { fetchNotices } from "../../lib/contentApi";
import { adminList } from "../../lib/adminApi";
import { useApiQuery } from "../../hooks/useApiQuery";
import { useTaxonomy } from "../../hooks/useTaxonomy";
import { NoticesBoard } from "../../components/dashboard/NoticesBoard";
import { noticeWithState } from "../../lib/noticeState";
import { formatRelativeTime, formatFileSize } from "../../lib/utils";
import type { Notice, Resource } from "../../types";

const QUICK_ACTIONS = [
  { to: "/admin/resources", label: "Add Resource", icon: Upload },
  { to: "/admin/semesters", label: "Add Subject", icon: BookOpen },
  { to: "/admin/notices", label: "Add Note", icon: Bell },
  { to: "/admin/semesters", label: "Manage Curriculum", icon: GraduationCap },
];

export default function AdminDashboard() {
  const { subjectName } = useTaxonomy();
  const statsQuery = useApiQuery("admin-dashboard-stats", async (signal) => {
    const [total, published, drafts, semesters, subjects, notices] = await Promise.all([
      adminList<Resource>("resources", { limit: 1 }, signal).catch(() => ({ total: 0 })),
      adminList<Resource>("resources", { status: "published", hidden: "false", limit: 1 }, signal).catch(() => ({ total: 0 })),
      adminList<Resource>("resources", { status: "draft", limit: 1 }, signal).catch(() => ({ total: 0 })),
      adminList("semesters", { limit: 1 }, signal).catch(() => ({ total: 0 })),
      adminList("subjects", { limit: 1 }, signal).catch(() => ({ total: 0 })),
      adminList("notices", { limit: 1 }, signal).catch(() => ({ total: 0 })),
    ]);
    return {
      totalResources: total.total,
      publishedResources: published.total,
      draftResources: drafts.total,
      semesters: semesters.total,
      subjects: subjects.total,
      notices: notices.total,
    };
  });
  const recentQuery = useApiQuery("admin-dashboard-recent", (signal) =>
    adminList<Resource>("resources", { limit: 7 }, signal),
  );
  const sizeQuery = useApiQuery("admin-dashboard-size", async (signal) => {
    const page = await adminList<Resource>("resources", { limit: 100 }, signal).catch(() => ({ rows: [] as Resource[] }));
    return (page.rows ?? []).reduce((s, r) => s + (r.fileSize ?? 0), 0);
  });
  const noticesQuery = useApiQuery("admin-dashboard-notices", (signal) =>
    fetchNotices(true, signal).then((list) => list.rows as Notice[]),
  );

  const stats = statsQuery.data ?? {
    totalResources: 0, publishedResources: 0, draftResources: 0,
    semesters: 0, subjects: 0, notices: 0,
  };
  const recentUploads = recentQuery.data?.rows ?? [];
  const totalLibrarySize = sizeQuery.data ?? 0;
  const dashboardNotices = (noticesQuery.data ?? []).map(noticeWithState);
  const loading = statsQuery.loading || recentQuery.loading;
  const error = statsQuery.error ?? recentQuery.error;

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Admin Dashboard"
          subtitle="Library overview and management shortcuts."
          actions={<Badge tone="warning">ADMIN</Badge>}
        />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-busy="true" aria-label="Loading dashboard">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse p-5"><div className="h-10 rounded bg-surface-muted" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="Admin Dashboard"
          subtitle="Library overview and management shortcuts."
          actions={<Badge tone="warning">ADMIN</Badge>}
        />
        <ErrorState message={error} onRetry={() => { statsQuery.retry(); recentQuery.retry(); }} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Library overview and management shortcuts."
        actions={<Badge tone="warning">ADMIN</Badge>}
      />

      {/* Real DB statistics */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Resources"
          value={stats.totalResources}
          hint={`${stats.publishedResources} published · ${stats.draftResources} drafts`}
          icon={<LibraryBig className="size-5" aria-hidden="true" />}
        />
        <StatCard
          label="Semesters"
          value={stats.semesters}
          hint={`${stats.subjects} subjects`}
          icon={<GraduationCap className="size-5" aria-hidden="true" />}
        />
        <StatCard
          label="Notices"
          value={stats.notices}
          hint={`${stats.publishedResources} published resources`}
          icon={<Bell className="size-5" aria-hidden="true" />}
        />
        <StatCard
          label="Library Size"
          value={formatFileSize(totalLibrarySize)}
          hint={`${stats.draftResources} drafts in progress`}
          icon={<Upload className="size-5" aria-hidden="true" />}
        />
      </div>

      {/* Quick actions */}
      <section className="mt-8" aria-labelledby="admin-actions">
        <h2 id="admin-actions" className="mb-3.5 text-lg font-semibold text-foreground">
          Quick Actions
        </h2>
        <div className="grid auto-rows-fr grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4 lg:gap-5 xl:gap-6">
          {QUICK_ACTIONS.map(({ to, label, icon: Icon }) => (
            <Link
              key={`${to}-${label}`}
              to={to}
              className="card-glow group flex h-full min-h-[112px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface p-5 text-center transition-all hover:border-primary/40 hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-[118px] lg:min-h-[132px]"
            >
              <span className="flex size-12 items-center justify-center rounded-lg bg-primary-muted text-primary">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <span className="text-xs font-bold leading-tight text-foreground group-hover:text-primary">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Notices preview — reuses existing Student Dashboard notice section, same data source */}
      {dashboardNotices.length > 0 && (
        <div className="mt-8">
          <NoticesBoard notices={dashboardNotices} seeAllTo="/admin/notices" />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Recent uploads (real DB timestamps) */}
        <section aria-labelledby="admin-recent">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 id="admin-recent" className="text-lg font-semibold text-foreground">
              Recent Uploads
            </h2>
            <Link to="/admin/resources" className="text-sm font-semibold text-primary hover:underline">
              Manage all
            </Link>
          </div>
          <Card className="divide-y divide-border">
            {recentUploads.length === 0 ? (
              <p className="p-5 text-sm font-medium text-muted-foreground">
                No uploads yet. Use &ldquo;Add Resource&rdquo; to get started.
              </p>
            ) : (
              recentUploads.map((r) => (
                <div key={r.id} className="flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-foreground">{r.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {subjectName(r.subjectId) ?? "—"} · {r.pageCount} pages · {formatFileSize(r.fileSize)}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground/70">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {formatRelativeTime(r.uploadedAt)}
                  </span>
                </div>
              ))
            )}
          </Card>
        </section>

        {/* Recent activity log — no backend activity API; preserve section as empty state */}
        <section aria-labelledby="admin-activity">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 id="admin-activity" className="text-lg font-semibold text-foreground">
              Recent Activity
            </h2>
            <Badge tone="neutral">
              <Star className="size-3" aria-hidden="true" />
              live
            </Badge>
          </div>
          <Card className="divide-y divide-border">
            <p className="p-5 text-sm font-medium text-muted-foreground">
              Admin actions will be logged here.
            </p>
          </Card>
        </section>
      </div>
    </div>
  );
}
