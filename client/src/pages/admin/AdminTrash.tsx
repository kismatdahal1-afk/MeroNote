import { useMemo, useState } from "react";
import { RotateCcw, Trash2, AlertTriangle } from "lucide-react";
import { PageHeader, Card } from "../../components/common/PageHeader";
import { IconButton } from "../../components/common/IconButton";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { Button } from "../../components/common/Button";
import { Badge } from "../../components/common/Badge";
import { useCms } from "../../state/CmsProvider";
import { restoreEntity, purgeEntity, emptyTrash } from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import { formatRelativeTime } from "../../lib/utils";
import type { CmsEntity } from "../../types";

interface TrashItem {
  id: string;
  entity: CmsEntity;
  label: string;
  detail: string;
  deletedAt: string;
}

const ENTITY_LABEL: Record<CmsEntity, string> = {
  semester: "Semester",
  subject: "Subject",
  topic: "Topic",
  resource: "Resource",
  notice: "Notice",
  book: "Book",
};

/** Trash: soft-deleted entities with restore + permanent delete. */
export default function AdminTrash() {
  const db = useCms();
  const { toast } = useToast();
  const [pendingPurge, setPendingPurge] = useState<TrashItem | null>(null);
  const [pendingEmpty, setPendingEmpty] = useState(false);

  const items: TrashItem[] = useMemo(() => {
    const out: TrashItem[] = [];
    for (const s of db.semesters.filter((x) => x.deletedAt)) {
      out.push({ id: s.id, entity: "semester", label: s.name, detail: s.description, deletedAt: s.deletedAt! });
    }
    for (const s of db.subjects.filter((x) => x.deletedAt)) {
      const sem = db.semesters.find((x) => x.id === s.semesterId);
      out.push({
        id: s.id, entity: "subject", label: s.name,
        detail: `${s.code}${sem ? ` · ${sem.name}` : ""}`, deletedAt: s.deletedAt!,
      });
    }
    for (const t of db.topics.filter((x) => x.deletedAt)) {
      const sub = db.subjects.find((x) => x.id === t.subjectId);
      out.push({
        id: t.id, entity: "topic", label: t.title,
        detail: sub?.name ?? "", deletedAt: t.deletedAt!,
      });
    }
    for (const r of db.resources.filter((x) => x.deletedAt)) {
      const sub = db.subjects.find((x) => x.id === r.subjectId);
      out.push({
        id: r.id, entity: "resource", label: r.title,
        detail: sub?.name ?? "", deletedAt: r.deletedAt!,
      });
    }
    for (const n of db.notices.filter((x) => x.deletedAt)) {
      out.push({ id: n.id, entity: "notice", label: n.heading, detail: n.subtext, deletedAt: n.deletedAt! });
    }
    for (const b of db.books.filter((x) => x.deletedAt)) {
      out.push({ id: b.id, entity: "book", label: b.title, detail: b.author, deletedAt: b.deletedAt! });
    }
    return out.sort((a, b) => +new Date(b.deletedAt) - +new Date(a.deletedAt));
  }, [db]);

  return (
    <div>
      <PageHeader
        title="Trash"
        subtitle="Soft-deleted content. Restore it, or delete it permanently."
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

      {items.length === 0 ? (
        <EmptyState
          title="Trash is empty"
          message="Deleted semesters, subjects, topics, resources, notices, and books will appear here."
        />
      ) : (
        <Card className="divide-y divide-border">
          {items.map((item) => (
            <div key={`${item.entity}-${item.id}`} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{ENTITY_LABEL[item.entity]}</Badge>
                  <p className="line-clamp-1 font-medium text-foreground">{item.label}</p>
                </div>
                {item.detail && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">{item.detail}</p>
                )}
                <p className="mt-0.5 text-[11px] font-medium text-muted-foreground/60">
                  Deleted {formatRelativeTime(item.deletedAt)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  restoreEntity(item.entity, item.id);
                  toast(`Restored "${item.label}"`);
                }}
              >
                <RotateCcw className="size-3.5" aria-hidden="true" /> Restore
              </Button>
              <IconButton
                icon={Trash2}
                label={`Permanently delete ${item.label}`}
                size="sm"
                variant="danger"
                onClick={() => setPendingPurge(item)}
              />
            </div>
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={pendingPurge !== null}
        title="Delete permanently"
        message={
          <>
            <AlertTriangle className="mb-2 size-5 text-error" aria-hidden="true" />
            &ldquo;{pendingPurge?.label}&rdquo; will be <strong>permanently deleted</strong> along with its children
            (subjects, topics, resources). This cannot be undone.
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
        }}
      />
    </div>
  );
}
