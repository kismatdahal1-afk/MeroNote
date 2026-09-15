import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2, EyeOff, FileEdit, FileText, Layers,
  LibraryBig, Pencil, Plus, Trash2, X,
} from "lucide-react";
import { PageHeader, Card, StatCard } from "../../components/common/PageHeader";
import { SearchBar } from "../../components/common/SearchBar";
import { IconButton } from "../../components/common/IconButton";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { Select } from "../../components/common/Field";
import { Button } from "../../components/common/Button";
import { FilterChips } from "../../components/resources/FilterChips";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { ResourceEditorModal } from "../../components/admin/ResourceEditorModal";
import { useCms } from "../../state/CmsProvider";
import { softDelete } from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import { RESOURCE_TYPE_CONFIG, resourceTypeLabel } from "../../lib/resourceType";
import { cx, formatFileSize, formatDate, formatRelativeTime } from "../../lib/utils";
import type { Resource, ResourceType } from "../../types";

type StatusFilter = "all" | "published" | "draft" | "hidden";

export default function AdminResources() {
  const db = useCms();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ResourceType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [semesterId, setSemesterId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Resource | null>(null);

  const semesters = useMemo(
    () => db.semesters.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order),
    [db.semesters],
  );

  const all = useMemo(() => db.resources.filter((r) => !r.deletedAt), [db.resources]);

  const stats = useMemo(
    () => ({
      total: all.length,
      published: all.filter((r) => r.status === "published").length,
      drafts: all.filter((r) => r.status === "draft").length,
      hidden: all.filter((r) => r.status === "hidden").length,
    }),
    [all],
  );

  /** Semester filter + search + type + status. */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = all;
    if (q) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (semesterId) list = list.filter((r) => r.semesterId === semesterId);
    if (type !== "all") list = list.filter((r) => r.type === type);
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    return list.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
  }, [all, query, semesterId, type, statusFilter]);

  const counts = useMemo(() => {
    let base = all;
    if (semesterId) base = base.filter((r) => r.semesterId === semesterId);
    if (statusFilter !== "all") base = base.filter((r) => r.status === statusFilter);
    const map: Partial<Record<ResourceType, number>> = {};
    for (const r of base) map[r.type] = (map[r.type] ?? 0) + 1;
    return map;
  }, [all, semesterId, statusFilter]);

  const anyFilterActive =
    query.trim() !== "" || type !== "all" || statusFilter !== "all" ||
    semesterId !== "";

  const clearFilters = () => {
    setQuery("");
    setType("all");
    setStatusFilter("all");
    setSemesterId("");
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const contextOf = (r: Resource) => {
    const semester = db.semesters.find((s) => s.id === r.semesterId);
    const subject = db.subjects.find((s) => s.id === r.subjectId);
    const topic = r.topicId ? db.topics.find((t) => t.id === r.topicId) : undefined;
    return { semester, subject, topic };
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Resource Management"
        subtitle="Organize and publish study materials across the library."
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Resources" },
        ]}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" /> Add Resource
          </Button>
        }
      />

      <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total Resources" value={stats.total} hint="All resources" icon={<LibraryBig className="size-5" aria-hidden="true" />} />
        <StatCard label="Published" value={stats.published} hint="Live resources" icon={<CheckCircle2 className="size-5" aria-hidden="true" />} />
        <StatCard label="Drafts" value={stats.drafts} hint="Unpublished" icon={<FileEdit className="size-5" aria-hidden="true" />} />
        <StatCard label="Hidden" value={stats.hidden} hint="Not visible" icon={<EyeOff className="size-5" aria-hidden="true" />} />
      </div>

      {/* Search + dropdown filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          placeholder="Search resources..."
          className="w-full sm:max-w-md sm:flex-1"
          onSubmit={setQuery}
          onChange={setQuery}
        />
        <div className="flex gap-3 sm:flex-wrap">
          <Select
            id="res-semester-filter"
            label=""
            value={semesterId}
            onChange={(e) => setSemesterId(e.target.value)}
            className={cx("min-w-0 flex-1 sm:w-44 sm:flex-none", semesterId && "[&>select]:border-primary/60 [&>select]:bg-primary-muted/40 [&>select]:font-semibold")}
            aria-label="Filter by semester"
            options={[
              { value: "", label: "All Semesters" },
              ...semesters.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <Select
            id="res-status-filter"
            label=""
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={cx("min-w-0 flex-1 sm:w-40 sm:flex-none", statusFilter !== "all" && "[&>select]:border-primary/60 [&>select]:bg-primary-muted/40 [&>select]:font-semibold")}
            aria-label="Filter by status"
            options={[
              { value: "all", label: "All Statuses" },
              { value: "published", label: "Published" },
              { value: "draft", label: "Draft" },
              { value: "hidden", label: "Hidden" },
            ]}
          />
          {anyFilterActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <X className="size-4" aria-hidden="true" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Resource type chips */}
      <div>
        <FilterChips selected={type} counts={counts} onChange={setType} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No resources match"
          message={query ? `Nothing matched "${query}".` : "No resources match the current filters."}
          actionLabel="Add Resource"
          onAction={openCreate}
        />
      ) : (
        <>
          {/* ── Desktop table ─────────────────────────────────── */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed min-w-[60rem] text-left text-sm xl:min-w-0">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-[11px] uppercase tracking-wider text-muted-foreground/80">
                    <th scope="col" className="w-[25%] px-4 py-3 font-semibold">Resource</th>
                    <th scope="col" className="w-[17%] px-3 py-3 font-semibold">Semester / Subject</th>
                    <th scope="col" className="w-[12%] px-2 py-3 font-semibold">Type</th>
                    <th scope="col" className="w-[11%] px-2 py-3 font-semibold">Size / Pages</th>
                    <th scope="col" className="w-[11%] px-2 py-3 font-semibold">Status</th>
                    <th scope="col" className="w-[11%] px-3 py-3 font-semibold">Added</th>
                    <th scope="col" className="w-[13%] px-3 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => {
                    const { semester, subject, topic } = contextOf(r);
                    const typeConfig = RESOURCE_TYPE_CONFIG[r.type];
                    const TypeIcon = typeConfig.icon;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => navigate(`/admin/resources/${r.id}`)}
                        className="cursor-pointer transition-colors hover:bg-surface-hover"
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={cx("flex size-9 shrink-0 items-center justify-center rounded-lg", typeConfig.badgeClass)}>
                              <TypeIcon className="size-4" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link
                                to={`/admin/resources/${r.id}`}
                                title={r.title}
                                onClick={(e) => e.stopPropagation()}
                                className="block truncate font-semibold text-foreground hover:text-primary"
                              >
                                {r.title}
                              </Link>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-xs text-muted-foreground">
                          <p className="truncate font-semibold text-foreground/80">{semester?.name ?? "—"}</p>
                          <p className="mt-0.5 truncate">
                            {topic ? `${subject?.name} · ${topic.title}` : subject?.name ?? "—"}
                          </p>
                        </td>
                        <td className="px-2 py-3.5">
                          <span className={cx("inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", typeConfig.badgeClass)}>
                            <span className="truncate">{resourceTypeLabel(r.type)}</span>
                          </span>
                        </td>
                        <td className="px-2 py-3.5">
                          <p className="truncate text-sm font-medium tabular-nums text-foreground/80">
                            {formatFileSize(r.fileSize)}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{r.pageCount} pages</p>
                        </td>
                        <td className="px-2 py-3.5">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-3 py-3.5">
                          <p className="truncate text-xs font-medium text-foreground/80">
                            {formatDate(r.uploadedAt)}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                            {formatRelativeTime(r.uploadedAt)}
                          </p>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton
                              icon={Pencil}
                              label={`Edit ${r.title}`}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditing(r);
                                setFormOpen(true);
                              }}
                            />
                            <IconButton
                              icon={Trash2}
                              label={`Delete ${r.title}`}
                              size="sm"
                              variant="danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete(r);
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ── Mobile cards ──────────────────────────────────── */}
          <div className="space-y-3 md:hidden">
            {filtered.map((r) => {
              const { semester, subject } = contextOf(r);
              const typeConfig = RESOURCE_TYPE_CONFIG[r.type];
              const TypeIcon = typeConfig.icon;
              return (
                <Card key={r.id} className="cursor-pointer p-4" onClick={() => navigate(`/admin/resources/${r.id}`)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", typeConfig.badgeClass)}>
                        <TypeIcon className="size-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <Link
                          to={`/admin/resources/${r.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="truncate text-sm font-bold text-foreground hover:text-primary"
                        >
                          {r.title}
                        </Link>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {semester?.name ?? "—"} · {subject?.name ?? "—"}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", typeConfig.badgeClass)}>
                      {resourceTypeLabel(r.type)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      <FileText className="size-3.5" aria-hidden="true" />
                      {formatFileSize(r.fileSize)} · {r.pageCount}p
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      <Layers className="size-3.5" aria-hidden="true" />
                      {formatRelativeTime(r.uploadedAt)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-1.5 border-t border-border pt-3">
                    <IconButton
                      icon={Pencil}
                      label={`Edit ${r.title}`}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(r);
                        setFormOpen(true);
                      }}
                    />
                    <IconButton
                      icon={Trash2}
                      label={`Delete ${r.title}`}
                      size="sm"
                      variant="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(r);
                      }}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <ResourceEditorModal
        open={formOpen}
        editing={editing ?? undefined}
        defaultSemesterId={semesterId || undefined}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete resource"
        message={`"${pendingDelete?.title}" will move to the trash. You can restore it from Trash, or delete it permanently there.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            softDelete("resource", pendingDelete.id);
            toast("Resource moved to trash");
          }
          setPendingDelete(null);
        }}
      />

    </div>
  );
}
