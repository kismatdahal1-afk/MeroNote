import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2, ChevronRight, EyeOff, FileEdit,
  LibraryBig, Pencil, Plus, Trash2, X,
} from "lucide-react";
import { PageHeader, Card, StatCard } from "../../components/common/PageHeader";
import { SearchBar, useSearchQuery } from "../../components/common/SearchBar";
import { IconButton } from "../../components/common/IconButton";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState, ErrorState } from "../../components/common/States";
import { Select } from "../../components/common/Field";
import { Button } from "../../components/common/Button";
import { FilterChips } from "../../components/resources/FilterChips";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { ResourceEditorModal } from "../../components/admin/ResourceEditorModal";
import { useToast } from "../../state/ToastProvider";
import { fetchSemesters, fetchTopics, ApiError } from "../../lib/contentApi";
import { adminDelete, adminList } from "../../lib/adminApi";
import { useTaxonomy } from "../../hooks/useTaxonomy";
import { useApiQuery } from "../../hooks/useApiQuery";
import { ResourcesSkeleton } from "../../components/skeletons/pages";
import { RESOURCE_TYPE_CONFIG, resourceTypeLabel } from "../../lib/resourceType";
import { cx, formatFileSize, formatDate, formatRelativeTime } from "../../lib/utils";
import type { Resource, ResourceType } from "../../types";

type StatusFilter = "all" | "published" | "draft" | "hidden";

export default function AdminResources() {
  const { toast } = useToast();
  const navigate = useNavigate();
  /** Search text lives in the URL (shared hook with the student Resources
   *  page), so the portal-aware header search can deep-link here with ?q=. */
  const [query, updateQuery] = useSearchQuery();
  const [type, setType] = useState<ResourceType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [semesterId, setSemesterId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Resource | null>(null);
  const { subjects: allSubjects } = useTaxonomy();

  const listKey = `admin-resources:${semesterId}:${type}:${statusFilter}:${query}`;
  const { data, error, loading, retry } = useApiQuery(listKey, (signal) =>
    adminList<Resource>("resources", {
      ...(semesterId ? { semesterId } : {}),
      ...(type !== "all" ? { type } : {}),
      ...(statusFilter === "hidden"
        ? { hidden: "true" }
        : statusFilter === "all"
          ? {}
          : { status: statusFilter, hidden: "false" }),
      limit: 100,
    }, signal),
  );
  const { data: semestersData } = useApiQuery("admin-resources-semesters", (signal) =>
    fetchSemesters(signal).then((list) => list.rows),
  );
  const semesters = useMemo(() => semestersData ?? [], [semestersData]);

  const serverRows = useMemo(() => data?.rows ?? [], [data]);
  const q = query.trim().toLowerCase();
  const all = useMemo(
    () => (q ? serverRows.filter((r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q))) : serverRows),
    [serverRows, query],
  );

  const stats = useApiQuery(`admin-resources-stats:${semesterId}`, async (signal) => {
    const base = semesterId ? { semesterId } : {};
    const [total, published, drafts, hidden] = await Promise.all([
      adminList<Resource>("resources", { ...base, limit: 1 }, signal).catch(() => ({ total: 0 })),
      adminList<Resource>("resources", { ...base, status: "published", hidden: "false", limit: 1 }, signal).catch(() => ({ total: 0 })),
      adminList<Resource>("resources", { ...base, status: "draft", limit: 1 }, signal).catch(() => ({ total: 0 })),
      adminList<Resource>("resources", { ...base, hidden: "true", limit: 1 }, signal).catch(() => ({ total: 0 })),
    ]);
    return { total: total.total, published: published.total, drafts: drafts.total, hidden: hidden.total };
  });

  const subjectIdsKey = useMemo(
    () => [...new Set(all.map((r) => r.subjectId))].sort().join(","),
    [all],
  );
  const { data: topicsData } = useApiQuery(`admin-resources-topics:${subjectIdsKey}`, async (signal) => {
    if (!subjectIdsKey) return [];
    const lists = await Promise.all(
      subjectIdsKey.split(",").map((id) => fetchTopics(id, signal).catch(() => ({ rows: [], total: 0 }))),
    );
    return lists.flatMap((list) => list.rows);
  });
  const topicsById = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    for (const t of topicsData ?? []) map.set(t.id, t);
    return map;
  }, [topicsData]);

  const counts = useMemo(() => {
    const map: Partial<Record<ResourceType, number>> = {};
    for (const r of all) map[r.type] = (map[r.type] ?? 0) + 1;
    return map;
  }, [all]);

  const filtered = all;
  const totals = stats.data ?? { total: 0, published: 0, drafts: 0, hidden: 0 };

  const anyFilterActive =
    query.trim() !== "" || type !== "all" || statusFilter !== "all" ||
    semesterId !== "";

  const clearFilters = () => {
    updateQuery("");
    setType("all");
    setStatusFilter("all");
    setSemesterId("");
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  /** Delete always moves to trash (backend soft-deletes); confirm first. */
  const requestDelete = (r: Resource) => {
    setPendingDelete(r);
  };

  const confirmDelete = async (target: Resource) => {
    try {
      await adminDelete("resources", target.id);
      toast("Resource moved to trash");
      retry();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not delete resource.", "error");
    }
  };

  const contextOf = (r: Resource) => {
    const semester = semesters.find((s) => s.id === r.semesterId);
    const subject = allSubjects.find((s) => s.id === r.subjectId);
    const topic = r.topicId ? topicsById.get(r.topicId) : undefined;
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
        <StatCard label="Total Resources" value={totals.total} hint="All resources" icon={<LibraryBig className="size-5" aria-hidden="true" />} />
        <StatCard label="Published" value={totals.published} hint="Live resources" icon={<CheckCircle2 className="size-5" aria-hidden="true" />} />
        <StatCard label="Drafts" value={totals.drafts} hint="Unpublished" icon={<FileEdit className="size-5" aria-hidden="true" />} />
        <StatCard label="Hidden" value={totals.hidden} hint="Not visible" icon={<EyeOff className="size-5" aria-hidden="true" />} />
      </div>

      {/* Search + dropdown filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          placeholder="Search resources..."
          className="w-full sm:max-w-md sm:flex-1"
          initialValue={query}
          onSubmit={updateQuery}
          onChange={updateQuery}
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

      {loading ? (
        <ResourcesSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : filtered.length === 0 ? (
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
                        onClick={() => navigate(`/admin/resources/${r.id}`, { state: { via: "resources" } })}
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
                                state={{ via: "resources" }}
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
                                requestDelete(r);
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

          {/* ── Mobile cards: student ResourceCard pattern + admin actions ── */}
          <div className="space-y-3 md:hidden">
            {filtered.map((r) => {
              const { semester, subject } = contextOf(r);
              const typeConfig = RESOURCE_TYPE_CONFIG[r.type];
              const TypeIcon = typeConfig.icon;
              const openDetail = () => navigate(`/admin/resources/${r.id}`, { state: { via: "resources" } });
              return (
                <Card key={r.id} className="cursor-pointer p-4" onClick={openDetail}>
                  <div className="flex items-center gap-2.5">
                    <div className={cx("flex size-9 shrink-0 items-center justify-center rounded-lg", typeConfig.badgeClass)}>
                      <TypeIcon className="size-4.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 line-clamp-1 text-sm font-bold leading-snug text-foreground">
                          {r.title}
                        </p>
                        <span className="shrink-0">
                          <StatusBadge status={r.status} />
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                        {resourceTypeLabel(r.type)} · {r.pageCount} pages · {formatFileSize(r.fileSize)}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground/80">
                        {[semester?.name, subject?.name].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
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
                          requestDelete(r);
                        }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Open ${r.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetail();
                    }}
                    className="mt-2.5 flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-primary-muted text-xs font-bold text-primary transition-colors hover:bg-primary-muted-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Open
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </button>
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
        onSaved={() => retry()}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete resource"
        message={`"${pendingDelete?.title}" will move to the trash. You can restore it from Trash.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (target) void confirmDelete(target);
        }}
      />

    </div>
  );
}
