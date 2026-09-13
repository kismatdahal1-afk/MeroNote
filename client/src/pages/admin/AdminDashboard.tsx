import { Link } from "react-router-dom";
import {
  LibraryBig, GraduationCap, BookMarked, Upload, FileEdit, ArrowRight, Clock,
} from "lucide-react";
import { PageHeader, Card, StatCard } from "../../components/common/PageHeader";
import { Badge } from "../../components/common/Badge";
import {
  getAllSemesters,
  getAllResources,
} from "../../data/selectors";
import { subjects as allSubjects } from "../../data/mock";
import { formatRelativeTime, formatFileSize } from "../../lib/utils";

const MANAGEMENT_LINKS = [
  {
    to: "/admin/upload",
    title: "Upload Resource",
    description: "Add a new PDF with its metadata to the library.",
    icon: Upload,
  },
  {
    to: "/admin/resources",
    title: "Manage Resources",
    description: "Edit, review, or remove existing resources.",
    icon: FileEdit,
  },
];

export default function AdminDashboard() {
  const semesters = getAllSemesters();
  const resources = getAllResources();
  const recentUploads = [...resources]
    .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Library overview and management shortcuts."
        actions={
          <Badge tone="warning">ADMIN</Badge>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total Resources" value={resources.length} icon={<LibraryBig className="size-5" aria-hidden="true" />} />
        <StatCard label="Semesters" value={semesters.length} icon={<GraduationCap className="size-5" aria-hidden="true" />} />
        <StatCard label="Subjects" value={allSubjects.length} icon={<BookMarked className="size-5" aria-hidden="true" />} />
        <StatCard
          label="Library Size"
          value={formatFileSize(resources.reduce((s, r) => s + r.fileSize, 0))}
          icon={<Upload className="size-5" aria-hidden="true" />}
        />
      </div>

      {/* Management shortcuts */}
      <section className="mt-8" aria-labelledby="admin-actions">
        <h2 id="admin-actions" className="mb-3.5 text-lg font-semibold text-foreground">
          Quick Actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {MANAGEMENT_LINKS.map(({ to, title, description, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-all hover:border-primary/40 hover:shadow-card-hover"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary ">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-foreground group-hover:text-primary">
                  {title}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
              </span>
              <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      {/* Recent uploads */}
      <section className="mt-8" aria-labelledby="admin-recent">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 id="admin-recent" className="text-lg font-semibold text-foreground">
            Recent Uploads
          </h2>
          <Link to="/admin/resources" className="text-sm font-semibold text-primary hover:underline">
            Manage all
          </Link>
        </div>
        <Card className="divide-y divide-border">
          {recentUploads.map((r) => (
            <div key={r.id} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium text-foreground">{r.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.subjectId} · {r.pageCount} pages · {formatFileSize(r.fileSize)}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground/70">
                <Clock className="size-3.5" aria-hidden="true" />
                {formatRelativeTime(r.uploadedAt)}
              </span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
