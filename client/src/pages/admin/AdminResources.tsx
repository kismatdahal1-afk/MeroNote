import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2, Plus } from "lucide-react";
import { PageHeader, Card } from "../../components/common/PageHeader";
import { SearchBar } from "../../components/common/SearchBar";
import { IconButton } from "../../components/common/IconButton";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { FilterChips } from "../../components/resources/FilterChips";
import {
  getAllResources,
  getSubjectById,
  searchResources,
} from "../../data/selectors";
import { RESOURCE_TYPE_CONFIG, resourceTypeLabel } from "../../lib/resourceType";
import { cx, formatFileSize, formatDate } from "../../lib/utils";
import { useToast } from "../../state/ToastProvider";
import type { ResourceType } from "../../types";

export default function AdminResources() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ResourceType | "all">("all");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  /** IDs "removed" by mock delete â€” kept in a local set so nothing real is touched. */
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const all = useMemo(() => {
    const base = query.trim() ? searchResources(query) : getAllResources();
    return base.filter((r) => !hidden.has(r.id));
  }, [query, hidden]);

  const counts = useMemo(() => {
    const map: Partial<Record<ResourceType, number>> = {};
    for (const r of all) map[r.type] = (map[r.type] ?? 0) + 1;
    return map;
  }, [all]);

  const filtered = useMemo(
    () => (filter === "all" ? all : all.filter((r) => r.type === filter)),
    [all, filter],
  );

  return (
    <div>
      <PageHeader
        title="Resource Management"
        subtitle="Search, review, edit, or remove library resources."
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Resources" },
        ]}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          placeholder="Search resources..."
          className="max-w-md flex-1"
          onSubmit={setQuery}
        />
        <Link
          to="/admin/upload"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
        >
          <Plus className="size-4" aria-hidden="true" /> Upload
        </Link>
      </div>

      <div className="mb-5">
        <FilterChips selected={filter} counts={counts} onChange={setFilter} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No resources match"
          message={query ? `Nothing matched "${query}".` : "The library is empty."}
          actionLabel="Upload a resource"
          onAction={() => (window.location.pathname = "/admin/upload")}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground/70">
                  <th scope="col" className="px-4 py-3 font-medium">Resource</th>
                  <th scope="col" className="px-4 py-3 font-medium">Type</th>
                  <th scope="col" className="px-4 py-3 font-medium">Subject</th>
                  <th scope="col" className="px-4 py-3 font-medium">Size</th>
                  <th scope="col" className="px-4 py-3 font-medium">Uploaded</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => {
                  const subject = getSubjectById(r.subjectId);
                  const typeConfig = RESOURCE_TYPE_CONFIG[r.type];
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-surface-hover">
                      <td className="max-w-xs px-4 py-3">
                        <Link to={`/resources/${r.id}`} className="line-clamp-1 font-medium text-foreground hover:text-primary">
                          {r.title}
                        </Link>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">{r.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", typeConfig.badgeClass)}>
                          {resourceTypeLabel(r.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {subject?.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatFileSize(r.fileSize)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(r.uploadedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            icon={Pencil}
                            label={`Edit ${r.title}`}
                            size="sm"
                            onClick={() => toast("Editing arrives in Phase 4/5", "info")}
                          />
                          <IconButton
                            icon={Trash2}
                            label={`Delete ${r.title}`}
                            size="sm"
                            variant="danger"
                            onClick={() => setPendingDelete(r.id)}
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete resource"
        message="This removes the resource and its file from the library. Users will no longer be able to access it. (Mock â€” nothing real is deleted.)"
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            setHidden((prev) => new Set(prev).add(pendingDelete));
            toast("Resource deleted (mock)");
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
