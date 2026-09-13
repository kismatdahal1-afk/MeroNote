import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Pencil, Trash2, Plus, Star, Eye, EyeOff } from "lucide-react";
import { PageHeader, Card } from "../../components/common/PageHeader";
import { SearchBar } from "../../components/common/SearchBar";
import { IconButton } from "../../components/common/IconButton";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { Select } from "../../components/common/Field";
import { Button } from "../../components/common/Button";
import { FilterChips } from "../../components/resources/FilterChips";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { ResourceFormModal } from "../../components/admin/ResourceFormModal";
import { useCms } from "../../state/CmsProvider";
import { setResourceStatus, toggleResourceFeatured, softDelete } from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import { RESOURCE_TYPE_CONFIG, resourceTypeLabel } from "../../lib/resourceType";
import { cx, formatFileSize, formatDate } from "../../lib/utils";
import type { Resource, ResourceType } from "../../types";

type StatusFilter = "all" | "published" | "draft" | "hidden";

export default function AdminResources() {
  const db = useCms();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ResourceType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [semesterId, setSemesterId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Resource | null>(null);

  // "Add Resource" quick action deep link: /admin/resources?new=1
  useEffect(() => {
    if (params.get("new")) {
      setEditing(null);
      setFormOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const semesters = useMemo(
    () => db.semesters.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order),
    [db.semesters],
  );
  const subjects = useMemo(
    () =>
      semesterId
        ? db.subjects.filter((s) => !s.deletedAt && s.semesterId === semesterId)
        : db.subjects.filter((s) => !s.deletedAt),
    [db.subjects, semesterId],
  );
  const topics = useMemo(
    () => (subjectId ? db.topics.filter((t) => !t.deletedAt && t.subjectId === subjectId) : []),
    [db.topics, subjectId],
  );

  const all = useMemo(() => db.resources.filter((r) => !r.deletedAt), [db.resources]);

  /** Semester → Subject → Topic → Resource cascade filters + search + type + status. */
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
    if (subjectId) list = list.filter((r) => r.subjectId === subjectId);
    if (topicId) list = list.filter((r) => r.topicId === topicId);
    if (type !== "all") list = list.filter((r) => r.type === type);
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    return list.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
  }, [all, query, semesterId, subjectId, topicId, type, statusFilter]);

  const counts = useMemo(() => {
    let base = all;
    if (semesterId) base = base.filter((r) => r.semesterId === semesterId);
    if (subjectId) base = base.filter((r) => r.subjectId === subjectId);
    if (topicId) base = base.filter((r) => r.topicId === topicId);
    if (statusFilter !== "all") base = base.filter((r) => r.status === statusFilter);
    const map: Partial<Record<ResourceType, number>> = {};
    for (const r of base) map[r.type] = (map[r.type] ?? 0) + 1;
    return map;
  }, [all, semesterId, subjectId, topicId, statusFilter]);

  return (
    <div>
      <PageHeader
        title="Resource Management"
        subtitle="All study materials — organized by Semester → Subject → Topic."
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Resources" },
        ]}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" /> Add Resource
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          placeholder="Search resources..."
          className="max-w-md flex-1"
          onSubmit={setQuery}
          onChange={setQuery}
        />
        <div className="grid grid-cols-2 gap-3 lg:flex">
          <Select
            id="res-semester-filter"
            label=""
            value={semesterId}
            onChange={(e) => {
              setSemesterId(e.target.value);
              setSubjectId("");
              setTopicId("");
            }}
            className="w-full lg:w-44"
            aria-label="Filter by semester"
            options={[
              { value: "", label: "All semesters" },
              ...semesters.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <Select
            id="res-subject-filter"
            label=""
            value={subjectId}
            disabled={!semesterId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setTopicId("");
            }}
            className="w-full lg:w-52"
            aria-label="Filter by subject"
            options={[
              { value: "", label: semesterId ? "All subjects" : "Semester" },
              ...subjects.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <Select
            id="res-topic-filter"
            label=""
            value={topicId}
            disabled={!subjectId}
            onChange={(e) => setTopicId(e.target.value)}
            className="w-full lg:w-48"
            aria-label="Filter by topic"
            options={[
              { value: "", label: subjectId ? "All topics" : "Subject" },
              ...topics.map((t) => ({ value: t.id, label: t.title })),
            ]}
          />
          <Select
            id="res-status-filter"
            label=""
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-full lg:w-40"
            aria-label="Filter by status"
            options={[
              { value: "all", label: "All statuses" },
              { value: "published", label: "Published" },
              { value: "draft", label: "Draft" },
              { value: "hidden", label: "Hidden" },
            ]}
          />
        </div>
      </div>

      <div className="mb-5">
        <FilterChips selected={type} counts={counts} onChange={setType} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No resources match"
          message={query ? `Nothing matched "${query}".` : "No resources match the current filters."}
          actionLabel="Add Resource"
          onAction={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground/70">
                  <th scope="col" className="px-4 py-3 font-medium">Resource</th>
                  <th scope="col" className="px-4 py-3 font-medium">Context</th>
                  <th scope="col" className="px-4 py-3 font-medium">Type</th>
                  <th scope="col" className="px-4 py-3 font-medium">Size</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => {
                  const subject = db.subjects.find((s) => s.id === r.subjectId);
                  const semester = db.semesters.find((s) => s.id === r.semesterId);
                  const topic = r.topicId ? db.topics.find((t) => t.id === r.topicId) : undefined;
                  const typeConfig = RESOURCE_TYPE_CONFIG[r.type];
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-surface-hover">
                      <td className="max-w-xs px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {r.featured && (
                            <Star className="size-3.5 shrink-0 fill-current text-warning" aria-label="Featured" />
                          )}
                          <Link
                            to={`/resources/${r.id}`}
                            className="line-clamp-1 font-medium text-foreground hover:text-primary"
                          >
                            {r.title}
                          </Link>
                        </div>
                        {r.paperYear && (
                          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground/60">
                            Past paper · {r.paperYear}
                            {r.paperFullMarks ? ` · FM ${r.paperFullMarks}` : ""}
                            {r.paperDurationMinutes ? ` · ${r.paperDurationMinutes} min` : ""}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <p className="font-medium">{semester?.name ?? "—"}</p>
                        <p className="mt-0.5 line-clamp-1">{topic ? `${subject?.name} · ${topic.title}` : subject?.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", typeConfig.badgeClass)}>
                          {resourceTypeLabel(r.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatFileSize(r.fileSize)}
                        <span className="block text-xs">{r.pageCount} pages</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                        <p className="mt-1 text-[11px] text-muted-foreground/70">{formatDate(r.uploadedAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            icon={Star}
                            label={r.featured ? `Unfeature ${r.title}` : `Feature ${r.title}`}
                            size="sm"
                            variant={r.featured ? "active" : "default"}
                            filled={r.featured}
                            onClick={() => toggleResourceFeatured(r.id)}
                          />
                          <IconButton
                            icon={r.status === "published" ? EyeOff : Eye}
                            label={r.status === "published" ? `Unpublish ${r.title}` : `Publish ${r.title}`}
                            size="sm"
                            onClick={() => setResourceStatus(r.id, r.status === "published" ? "hidden" : "published")}
                          />
                          <IconButton
                            icon={Pencil}
                            label={`Edit ${r.title}`}
                            size="sm"
                            onClick={() => {
                              setEditing(r);
                              setFormOpen(true);
                            }}
                          />
                          <IconButton
                            icon={Trash2}
                            label={`Delete ${r.title}`}
                            size="sm"
                            variant="danger"
                            onClick={() => setPendingDelete(r)}
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
      )}

      <ResourceFormModal
        open={formOpen}
        editing={editing ?? undefined}
        defaultSemesterId={semesterId || undefined}
        defaultSubjectId={subjectId || undefined}
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
