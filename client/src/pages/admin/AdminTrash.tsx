import { useMemo, useState } from "react";
import {
  AlertTriangle, Bell, BookMarked, FileText, GraduationCap, HardDrive,
  Library, ListChecks, RotateCcw, Trash2, type LucideIcon,
} from "lucide-react";
import { PageHeader, Card } from "../../components/common/PageHeader";
import { IconButton } from "../../components/common/IconButton";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { Button } from "../../components/common/Button";
import { Badge } from "../../components/common/Badge";
import { useCms } from "../../state/CmsProvider";
import { restoreEntity, purgeEntity, emptyTrash } from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import { cx, formatDate, formatFileSize, formatRelativeTime } from "../../lib/utils";
import type { CmsEntity, Semester, Subject } from "../../types";

interface TrashItem {
  id: string;
  entity: CmsEntity;
  label: string;
  detail: string;
  /** Parent semester/subject context (empty when not applicable). */
  semesterId: string;
  subjectId: string;
  deletedAt: string;
  /** File size in bytes, when applicable (resources/books). */
  fileSize?: number;
}

const ENTITY_CONFIG: Record<CmsEntity, { label: string; icon: LucideIcon; badgeClass: string }> = {
  resource: { label: "Resource", icon: FileText, badgeClass: "bg-primary-muted text-primary" },
  topic: { label: "Topic", icon: ListChecks, badgeClass: "bg-accent/15 text-accent" },
  notice: { label: "Notice", icon: Bell, badgeClass: "bg-warning-muted text-warning" },
  semester: { label: "Semester", icon: GraduationCap, badgeClass: "bg-secondary/15 text-secondary" },
  subject: { label: "Subject", icon: BookMarked, badgeClass: "bg-success-muted text-success" },
  book: { label: "Book", icon: Library, badgeClass: "bg-surface-muted text-muted-foreground" },
};

/** Chip filters surfaced in the UI; "All" also covers books. */
type EntityFilter = "all" | "resource" | "topic" | "semester" | "notice" | "subject";

const CHIP_LABELS: { key: EntityFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "resource", label: "Resources" },
  { key: "topic", label: "Topics" },
  { key: "semester", label: "Semesters" },
  { key: "notice", label: "Notices" },
  { key: "subject", label: "Subjects" },
];

function StatTile({ label, value, icon: Icon, iconClass }: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <Card className="flex items-center justify-between gap-3 p-3.5">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      </div>
      <div className={cx("flex size-9 shrink-0 items-center justify-center rounded-lg", iconClass)}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
    </Card>
  );
}

/** Compact chip-style type filters with counts. */
function EntityChips({
  selected,
  counts,
  onChange,
}: {
  selected: EntityFilter;
  counts: Record<EntityFilter, number>;
  onChange: (next: EntityFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter by deleted item type"
      className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {CHIP_LABELS.map(({ key, label }) => {
        const isActive = selected === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(key)}
            className={cx(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              isActive
                ? "bg-primary text-primary-foreground"
                : "border border-border-strong bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            )}
          >
            {label} <span className={cx("tabular-nums", isActive ? "opacity-80" : "opacity-60")}>({counts[key]})</span>
          </button>
        );
      })}
    </div>
  );
}

/** Trash: soft-deleted content with restore + permanent delete. */
export default function AdminTrash() {
  const db = useCms();
  const { toast } = useToast();
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");
  const [pendingPurge, setPendingPurge] = useState<TrashItem | null>(null);
  const [pendingEmpty, setPendingEmpty] = useState(false);

  /** Every soft-deleted item across the store, newest first. */
  const items: TrashItem[] = useMemo(() => {
    const out: TrashItem[] = [];
    for (const s of db.semesters) {
      if (!s.deletedAt) continue;
      out.push({ id: s.id, entity: "semester", label: s.name, detail: s.description, semesterId: "", subjectId: "", deletedAt: s.deletedAt });
    }
    for (const s of db.subjects) {
      if (!s.deletedAt) continue;
      out.push({ id: s.id, entity: "subject", label: s.name, detail: s.code, semesterId: s.semesterId, subjectId: "", deletedAt: s.deletedAt });
    }
    for (const t of db.topics) {
      if (!t.deletedAt) continue;
      const sub = db.subjects.find((x) => x.id === t.subjectId);
      out.push({
        id: t.id, entity: "topic", label: t.title, detail: t.description ?? "",
        semesterId: sub?.semesterId ?? "", subjectId: t.subjectId, deletedAt: t.deletedAt,
      });
    }
    for (const r of db.resources) {
      if (!r.deletedAt) continue;
      out.push({
        id: r.id, entity: "resource", label: r.title, detail: r.description,
        semesterId: r.semesterId, subjectId: r.subjectId, deletedAt: r.deletedAt,
        fileSize: r.fileSize,
      });
    }
    for (const n of db.notices) {
      if (!n.deletedAt) continue;
      out.push({
        id: n.id, entity: "notice", label: n.heading, detail: n.subtext,
        semesterId: n.semesterId ?? "", subjectId: n.subjectId ?? "", deletedAt: n.deletedAt,
      });
    }
    for (const b of db.books) {
      if (!b.deletedAt) continue;
      out.push({
        id: b.id, entity: "book", label: b.title, detail: b.author,
        semesterId: b.semesterId, subjectId: b.subjectId, deletedAt: b.deletedAt,
        fileSize: b.fileSize,
      });
    }
    return out.sort((a, b) => +new Date(b.deletedAt) - +new Date(a.deletedAt));
  }, [db]);

  const counts: Record<EntityFilter, number> = useMemo(
    () => ({
      all: items.length,
      resource: items.filter((i) => i.entity === "resource").length,
      topic: items.filter((i) => i.entity === "topic").length,
      semester: items.filter((i) => i.entity === "semester").length,
      notice: items.filter((i) => i.entity === "notice").length,
      subject: items.filter((i) => i.entity === "subject").length,
    }),
    [items],
  );

  /** Total file size of soft-deleted resources. */
  const deletedStorage = useMemo(
    () => db.resources.filter((r) => r.deletedAt).reduce((sum, r) => sum + r.fileSize, 0),
    [db.resources],
  );

  const filtered = useMemo(
    () => (entityFilter === "all" ? items : items.filter((i) => i.entity === entityFilter)),
    [items, entityFilter],
  );

  /** Name lookup against the FULL store (parents may themselves be trashed). */
  const nameOf = (collection: Semester[] | Subject[], id: string) =>
    collection.find((x) => x.id === id)?.name ?? "—";

  const restore = (item: TrashItem) => {
    restoreEntity(item.entity, item.id);
    toast(`Restored "${item.label}"`);
  };

  const purgeCascade =
    pendingPurge && (pendingPurge.entity === "semester" || pendingPurge.entity === "subject")
      ? " — everything inside it will be deleted too"
      : "";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trash"
        subtitle="Recover deleted content, or remove it permanently."
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Trash" },
        ]}
        actions={
          items.length > 0 ? (
            <Button variant="danger" onClick={() => setPendingEmpty(true)}>
              <Trash2 className="size-4" aria-hidden="true" /> Empty Trash
            </Button>
          ) : (
            <Badge tone="neutral">Empty</Badge>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Total Deleted Items"
          value={counts.all}
          icon={Trash2}
          iconClass="bg-error-muted text-error"
        />
        <StatTile
          label="Deleted Storage"
          value={formatFileSize(deletedStorage)}
          icon={HardDrive}
          iconClass="bg-primary-muted text-primary"
        />
      </div>

      <EntityChips selected={entityFilter} counts={counts} onChange={setEntityFilter} />

      {items.length === 0 ? (
        <EmptyState
          title="Trash is empty"
          message="Deleted resources, topics, notices, and semesters will appear here for recovery."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nothing here"
          message="No deleted items in this category."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-[11px] uppercase tracking-wider text-muted-foreground/80">
                  <th scope="col" className="px-4 py-3 font-semibold">Deleted Item</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Semester</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Subject</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Deleted On</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => {
                  const config = ENTITY_CONFIG[item.entity];
                  const Icon = config.icon;
                  return (
                    <tr
                      key={`${item.entity}-${item.id}`}
                      onClick={() => restore(item)}
                      className="cursor-pointer transition-colors hover:bg-surface-hover"
                    >
                      <td className="max-w-[280px] px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={cx("flex size-9 shrink-0 items-center justify-center rounded-lg", config.badgeClass)}>
                            <Icon className="size-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{item.label}</p>
                            {item.detail && (
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/80">{item.detail}</p>
                            )}
                            {item.fileSize !== undefined && (
                              <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground/70">
                                {formatFileSize(item.fileSize)}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", config.badgeClass)}>
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {item.semesterId ? nameOf(db.semesters, item.semesterId) : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {item.subjectId ? nameOf(db.subjects, item.subjectId) : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs font-medium text-foreground/80">{formatDate(item.deletedAt)}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                          {formatRelativeTime(item.deletedAt)}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              restore(item);
                            }}
                          >
                            <RotateCcw className="size-3.5" aria-hidden="true" /> Restore
                          </Button>
                          <IconButton
                            icon={Trash2}
                            label={`Delete ${item.label} forever`}
                            size="sm"
                            variant="danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingPurge(item);
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
      )}

      <ConfirmDialog
        open={pendingPurge !== null}
        title="Delete permanently"
        message={
          <>
            <AlertTriangle className="mb-2 size-5 text-error" aria-hidden="true" />
            &ldquo;{pendingPurge?.label}&rdquo; will be <strong>permanently deleted</strong>
            {purgeCascade}. This cannot be undone.
          </>
        }
        confirmLabel="Delete forever"
        danger
        onCancel={() => setPendingPurge(null)}
        onConfirm={() => {
          if (pendingPurge) {
            purgeEntity(pendingPurge.entity, pendingPurge.id);
            toast(`"${pendingPurge.label}" permanently deleted`, "error");
          }
          setPendingPurge(null);
        }}
      />

      <ConfirmDialog
        open={pendingEmpty}
        title="Empty trash"
        message={
          <>
            <AlertTriangle className="mb-2 size-5 text-error" aria-hidden="true" />
            All {items.length} trashed items will be <strong>permanently deleted</strong>. This cannot be undone.
          </>
        }
        confirmLabel="Delete everything"
        danger
        onCancel={() => setPendingEmpty(false)}
        onConfirm={() => {
          emptyTrash();
          toast("Trash emptied", "error");
          setPendingEmpty(false);
          setEntityFilter("all");
        }}
      />
    </div>
  );
}
