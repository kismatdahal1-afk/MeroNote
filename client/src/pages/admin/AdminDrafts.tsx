import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2, Rocket, Bell } from "lucide-react";
import { PageHeader, Card } from "../../components/common/PageHeader";
import { IconButton } from "../../components/common/IconButton";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { Button } from "../../components/common/Button";
import { Badge } from "../../components/common/Badge";
import { ResourceFormModal } from "../../components/admin/ResourceFormModal";
import { useCms } from "../../state/CmsProvider";
import {
  setResourceStatus, setNoticeStatus, softDelete,
  setSemesterStatus, setSubjectStatus, updateTopic, updateBook,
} from "../../state/cmsStore";
import { formatDate } from "../../lib/utils";
import type { Resource, Notice, PublishStatus } from "../../types";

/** Drafts board: every draft entity in one place with one-click publish. */
export default function AdminDrafts() {
  const db = useCms();
  const [pendingDelete, setPendingDelete] = useState<Resource | null>(null);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const draftResources = useMemo(
    () =>
      db.resources
        .filter((r) => !r.deletedAt && r.status === "draft")
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
    [db.resources],
  );
  const draftNotices = useMemo(
    () => db.notices.filter((n) => !n.deletedAt && n.status === "draft"),
    [db.notices],
  );
  const draftSemesters = useMemo(
    () => db.semesters.filter((s) => !s.deletedAt && s.status === "draft"),
    [db.semesters],
  );
  const draftSubjects = useMemo(
    () => db.subjects.filter((s) => !s.deletedAt && s.status === "draft"),
    [db.subjects],
  );
  const draftTopics = useMemo(
    () => db.topics.filter((t) => !t.deletedAt && t.status === "draft"),
    [db.topics],
  );
  const draftBooks = useMemo(
    () => db.books.filter((b) => !b.deletedAt && b.status === "draft"),
    [db.books],
  );

  const total =
    draftResources.length + draftNotices.length + draftSemesters.length +
    draftSubjects.length + draftTopics.length + draftBooks.length;

  const publish = (kind: string, id: string) => {
    const status: PublishStatus = "published";
    if (kind === "resource") setResourceStatus(id, status);
    else if (kind === "notice") setNoticeStatus(id, status);
    else if (kind === "semester") setSemesterStatus(id, status);
    else if (kind === "subject") setSubjectStatus(id, status);
    else if (kind === "topic") updateTopic(id, { status });
    else if (kind === "book") updateBook(id, { status });
  };

  return (
    <div>
      <PageHeader
        title="Drafts"
        subtitle="Unpublished content across the library — publish when ready."
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Drafts" },
        ]}
        actions={<Badge tone="warning">{total} drafts</Badge>}
      />

      {total === 0 ? (
        <EmptyState
          title="No drafts"
          message="Everything is published. Set any item's status to Draft to stage it here."
        />
      ) : (
        <div className="space-y-6">
          {draftResources.length > 0 && (
            <section aria-labelledby="draft-resources">
              <h2 id="draft-resources" className="mb-2.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Resources ({draftResources.length})
              </h2>
              <Card className="divide-y divide-border">
                {draftResources.map((r) => {
                  const subject = db.subjects.find((s) => s.id === r.subjectId);
                  return (
                    <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <Link to={`/resources/${r.id}`} className="line-clamp-1 font-medium text-foreground hover:text-primary">
                          {r.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground/70">
                          {subject?.name} · updated {formatDate(r.updatedAt)}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => publish("resource", r.id)}>
                        <Rocket className="size-3.5" aria-hidden="true" /> Publish
                      </Button>
                      <IconButton icon={Pencil} label={`Edit ${r.title}`} size="sm" onClick={() => { setEditing(r); setFormOpen(true); }} />
                      <IconButton icon={Trash2} label={`Delete ${r.title}`} size="sm" variant="danger" onClick={() => setPendingDelete(r)} />
                    </div>
                  );
                })}
              </Card>
            </section>
          )}

          {draftNotices.length > 0 && (
            <section aria-labelledby="draft-notices">
              <h2 id="draft-notices" className="mb-2.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Notices ({draftNotices.length})
              </h2>
              <Card className="divide-y divide-border">
                {draftNotices.map((n: Notice) => (
                  <div key={n.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 font-medium text-foreground">{n.heading}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground/70">
                        {n.type} · {formatDate(n.date)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => publish("notice", n.id)}>
                      <Bell className="size-3.5" aria-hidden="true" /> Publish
                    </Button>
                  </div>
                ))}
              </Card>
            </section>
          )}

          {draftSemesters.length > 0 && (
            <section aria-labelledby="draft-semesters">
              <h2 id="draft-semesters" className="mb-2.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Semesters ({draftSemesters.length})
              </h2>
              <Card className="divide-y divide-border">
                {draftSemesters.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-4">
                    <p className="min-w-0 flex-1 font-medium text-foreground">{s.name}</p>
                    <Button size="sm" variant="outline" onClick={() => publish("semester", s.id)}>Publish</Button>
                  </div>
                ))}
              </Card>
            </section>
          )}

          {draftSubjects.length > 0 && (
            <section aria-labelledby="draft-subjects">
              <h2 id="draft-subjects" className="mb-2.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Subjects ({draftSubjects.length})
              </h2>
              <Card className="divide-y divide-border">
                {draftSubjects.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground/70">{s.code}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => publish("subject", s.id)}>Publish</Button>
                  </div>
                ))}
              </Card>
            </section>
          )}

          {draftTopics.length > 0 && (
            <section aria-labelledby="draft-topics">
              <h2 id="draft-topics" className="mb-2.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Topics ({draftTopics.length})
              </h2>
              <Card className="divide-y divide-border">
                {draftTopics.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-4">
                    <p className="min-w-0 flex-1 font-medium text-foreground">{t.title}</p>
                    <Button size="sm" variant="outline" onClick={() => publish("topic", t.id)}>Publish</Button>
                  </div>
                ))}
              </Card>
            </section>
          )}

          {draftBooks.length > 0 && (
            <section aria-labelledby="draft-books">
              <h2 id="draft-books" className="mb-2.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Books ({draftBooks.length})
              </h2>
              <Card className="divide-y divide-border">
                {draftBooks.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{b.title}</p>
                      <p className="text-xs text-muted-foreground/70">{b.author}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => publish("book", b.id)}>Publish</Button>
                  </div>
                ))}
              </Card>
            </section>
          )}
        </div>
      )}

      <ResourceFormModal
        open={formOpen}
        editing={editing ?? undefined}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete draft"
        message={`"${pendingDelete?.title}" will move to the trash.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) softDelete("resource", pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
