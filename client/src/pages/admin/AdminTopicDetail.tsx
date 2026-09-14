import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BookMarked, ChevronRight, FileEdit, FileText, GraduationCap, Hash,
  History, ListOrdered, Pencil, Send, Trash2,
} from "lucide-react";
import { useCms } from "../../state/CmsProvider";
import { softDelete, updateTopic } from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { BackButton } from "../../components/common/BackButton";
import { Button } from "../../components/common/Button";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { PdfViewer } from "../../components/reader/PdfViewer";
import { formatFileSize, formatRelativeTime } from "../../lib/utils";
import type { Topic } from "../../types";

/** Chip-like metadata items shown in the topic path. */
const META_ICON = "size-3.5 shrink-0";
const META_ITEM =
  "inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-border bg-surface-muted/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground";

/**
 * Admin Topic Detail — topic management header + embedded PDF reader.
 * Compact path-style info strip (breadcrumb, status, semester, subject,
 * code, order, updated) with all actions (Edit / Publish-Unpublish /
 * Save as Draft / Delete); the shared PdfViewer below is the main
 * content area — same viewer the student panel uses.
 */
export default function AdminTopicDetail() {
  const db = useCms();
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const topic = useMemo(
    () => db.topics.find((t) => t.id === topicId && !t.deletedAt),
    [db.topics, topicId],
  );
  const subject = useMemo(
    () => (topic ? db.subjects.find((s) => s.id === topic.subjectId && !s.deletedAt) : undefined),
    [db.subjects, topic],
  );
  const semester = useMemo(
    () => (subject ? db.semesters.find((s) => s.id === subject.semesterId && !s.deletedAt) : undefined),
    [db.semesters, subject],
  );
  /** Live resources linked to this topic (resource.topicId). */
  const attachedResource = useMemo(
    () => (topic ? db.resources.find((r) => r.topicId === topic.id && !r.deletedAt) : undefined),
    [db.resources, topic],
  );

  const [pendingDelete, setPendingDelete] = useState(false);

  if (!topic) {
    return (
      <EmptyState
        title="Topic not found"
        message="This topic may have been deleted or is no longer available."
        actionLabel="Back to Topics"
        onAction={() => navigate("/admin/topics")}
      />
    );
  }

  /** Reopen the existing Add/Edit Topic form pre-filled (deep link) —
   *  saving updates the same topic, never creates a duplicate. The
   *  from=detail flag returns to this page once the modal closes; the
   *  replace keeps history clean (Back from the detail page still goes
   *  to the Topics list, not back into the edit URL). */
  const openEdit = () =>
    navigate(`/admin/topics?edit=${topic.id}&from=detail`, { replace: true });
  const setStatus = (status: Topic["status"], label: string) => {
    updateTopic(topic.id, { status });
    toast(label);
  };
  const handleDelete = () => {
    softDelete("topic", topic.id);
    toast("Topic moved to trash");
    navigate("/admin/topics");
  };

  const isPublished = topic.status === "published";
  const resourceMeta = attachedResource
    ? `${attachedResource.pageCount} pages · ${formatFileSize(attachedResource.fileSize)}`
    : undefined;

  return (
    <div className="flex flex-col gap-5">
      {/* Global back button */}
      <div className="-ml-1">
        <BackButton label="Back" fallbackTo="/admin/topics" />
      </div>

      {/* Topic info + actions — compact path-style strip */}
      <header className="card-glow rounded-xl border border-border bg-surface shadow-card">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
          {/* Identity + breadcrumb + status */}
          <div className="min-w-0 flex-1">
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-1 text-xs font-medium text-muted-foreground"
            >
              <Link
                to="/admin/topics"
                className="rounded px-1 py-0.5 font-semibold transition-colors hover:bg-surface-hover hover:text-primary"
              >
                Topics
              </Link>
              {subject && (
                <>
                  <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
                  <span className="max-w-[10rem] truncate px-1 py-0.5">{subject.name}</span>
                </>
              )}
              <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
              <span aria-current="page" className="max-w-[16rem] truncate px-1 py-0.5 font-bold text-foreground">
                {topic.title}
              </span>
            </nav>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 text-lg font-bold text-foreground sm:text-xl">{topic.title}</h1>
              <StatusBadge status={topic.status} />
            </div>

            {topic.description && (
              <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
                {topic.description}
              </p>
            )}

            {/* Metadata path — semester / subject / code / order / updated */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {semester && (
                <span className={META_ITEM}>
                  <GraduationCap className={META_ICON} aria-hidden="true" /> {semester.name}
                </span>
              )}
              {subject && (
                <span className={META_ITEM}>
                  <BookMarked className={META_ICON} aria-hidden="true" /> {subject.name}
                </span>
              )}
              {subject && (
                <span className={META_ITEM}>
                  <Hash className={META_ICON} aria-hidden="true" /> {subject.code}
                </span>
              )}
              <span className={META_ITEM}>
                <ListOrdered className={META_ICON} aria-hidden="true" /> Order #{topic.order}
              </span>
              {attachedResource && (
                <span className={META_ITEM}>
                  <FileText className={META_ICON} aria-hidden="true" /> {resourceMeta}
                </span>
              )}
              <span className={META_ITEM}>
                <History className={META_ICON} aria-hidden="true" /> Updated {formatRelativeTime(topic.updatedAt)}
              </span>
            </div>
          </div>

          {/* Actions — Edit / Publish-Unpublish / Save as Draft / Delete */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            <Button size="sm" variant="outline" onClick={openEdit}>
              <Pencil className="size-4" aria-hidden="true" /> Edit
            </Button>
            {isPublished ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setStatus("draft", `"${topic.title}" unpublished — moved to drafts`)}
              >
                <Send className="size-4 rotate-180" aria-hidden="true" /> Unpublish
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatus("published", `"${topic.title}" published`)}
              >
                <Send className="size-4" aria-hidden="true" /> Publish
              </Button>
            )}
            {topic.status !== "draft" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setStatus("draft", `"${topic.title}" saved as draft`)}
              >
                <FileEdit className="size-4" aria-hidden="true" /> Save as Draft
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-error hover:bg-error-muted hover:text-error"
              onClick={() => setPendingDelete(true)}
            >
              <Trash2 className="size-4" aria-hidden="true" /> Delete
            </Button>
          </div>
        </div>

        {/* Resource link strip — jump to the topic's resource file */}
        {attachedResource && (
          <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-muted/40 px-4 py-2.5 sm:px-5">
            <Link
              to={`/admin/resources/${attachedResource.id}`}
              state={{ via: "topics" }}
              className="group min-w-0 inline-flex items-center gap-2 rounded-lg py-0.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
            >
              <FileText className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate group-hover:underline">{attachedResource.title}</span>
            </Link>
            <span className="hidden shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 sm:block">
              Linked PDF
            </span>
          </div>
        )}
      </header>

      {/* PDF Reader — main content area (same shared viewer as students) */}
      {attachedResource ? (
        <PdfViewer
          variant="embedded"
          resource={attachedResource}
          subtitle={subject ? `${subject.name} · ${attachedResource.pageCount} pages` : `${attachedResource.pageCount} pages`}
          toolbarLeading={
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary">
              <FileText className="size-4" aria-hidden="true" />
            </span>
          }
          onDownload={() => toast("Download starts once Cloudinary storage is connected", "info")}
        />
      ) : (
        <div className="card-glow rounded-xl border border-border bg-surface shadow-card">
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-surface-muted">
              <FileText className="size-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-foreground">No PDF attached</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              This topic has no linked PDF yet. Use Edit to attach one, or link a resource from Resources.
            </p>
            <Button size="sm" variant="outline" onClick={openEdit}>
              <Pencil className="size-4" aria-hidden="true" /> Edit Topic
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation — existing admin trash flow */}
      <ConfirmDialog
        open={pendingDelete}
        title="Delete topic"
        message={`"${topic.title}" will move to the trash. Its resources will fall back to subject-wide resources.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(false)}
        onConfirm={() => {
          setPendingDelete(false);
          handleDelete();
        }}
      />
    </div>
  );
}
