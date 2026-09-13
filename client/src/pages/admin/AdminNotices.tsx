import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Pin, PinOff, Trash2, Pencil, Plus, Eye, EyeOff } from "lucide-react";
import { PageHeader, Card } from "../../components/common/PageHeader";
import { Input, Select, Textarea } from "../../components/common/Field";
import { Button } from "../../components/common/Button";
import { IconButton } from "../../components/common/IconButton";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Badge } from "../../components/common/Badge";
import { useCms } from "../../state/CmsProvider";
import {
  createNotice, updateNotice, setNoticeStatus, toggleNoticePinned,
  softDelete, noticeWithState,
} from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import { formatDate } from "../../lib/utils";
import type { Notice, NoticeType } from "../../types";

const NOTICE_TYPES: { value: NoticeType; label: string }[] = [
  { value: "exam", label: "Exam" },
  { value: "deadline", label: "Deadline" },
  { value: "announcement", label: "Announcement" },
  { value: "reminder", label: "Reminder" },
  { value: "general", label: "General" },
];

const TYPE_TONE: Record<NoticeType, "error" | "warning" | "primary" | "accent" | "neutral"> = {
  exam: "error",
  deadline: "warning",
  announcement: "primary",
  reminder: "accent",
  general: "neutral",
};

const PRIORITY_TONE: Record<Notice["priority"], "success" | "warning" | "error"> = {
  low: "success",
  normal: "warning",
  high: "error",
};

interface NoticeFormState {
  heading: string;
  subtext: string;
  type: NoticeType;
  date: string;
  semesterId: string;
  subjectId: string;
  priority: Notice["priority"];
  status: Notice["status"];
  showOnDashboard: boolean;
  pinned: boolean;
}

const emptyForm = (): NoticeFormState => ({
  heading: "",
  subtext: "",
  type: "announcement",
  date: new Date().toISOString().slice(0, 10),
  semesterId: "",
  subjectId: "",
  priority: "normal",
  status: "published",
  showOnDashboard: true,
  pinned: false,
});

export default function AdminNotices() {
  const db = useCms();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form, setForm] = useState<NoticeFormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof NoticeFormState, string>>>({});
  const [pendingDelete, setPendingDelete] = useState<Notice | null>(null);

  // "Add Notice" quick action deep link: /admin/notices?new=1
  useEffect(() => {
    if (params.get("new")) {
      setEditing(null);
      setForm(emptyForm());
      setFormOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const notices = useMemo(
    () =>
      db.notices
        .filter((n) => !n.deletedAt)
        .slice()
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return +new Date(b.updatedAt) - +new Date(a.updatedAt);
        }),
    [db.notices],
  );

  const subjects = useMemo(
    () => (form.semesterId ? db.subjects.filter((s) => !s.deletedAt && s.semesterId === form.semesterId) : []),
    [db.subjects, form.semesterId],
  );

  const openEdit = (n: Notice) => {
    setEditing(n);
    setForm({
      heading: n.heading,
      subtext: n.subtext,
      type: n.type,
      date: n.date.slice(0, 10),
      semesterId: n.semesterId ?? "",
      subjectId: n.subjectId ?? "",
      priority: n.priority,
      status: n.status,
      showOnDashboard: n.showOnDashboard,
      pinned: n.pinned,
    });
    setFormOpen(true);
  };

  const set = <K extends keyof NoticeFormState>(key: K, value: NoticeFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.heading.trim()) next.heading = "Heading is required.";
    if (!form.date) next.date = "Date is required.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const draft = {
      heading: form.heading.trim(),
      subtext: form.subtext.trim(),
      type: form.type,
      date: new Date(`${form.date}T00:00:00`).toISOString(),
      semesterId: form.semesterId || undefined,
      subjectId: form.subjectId || undefined,
      priority: form.priority,
      status: form.status,
      showOnDashboard: form.showOnDashboard,
      pinned: form.pinned,
    };
    if (editing) {
      updateNotice(editing.id, draft);
      toast("Notice updated");
    } else {
      createNotice(draft);
      toast("Notice created");
    }
    setFormOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Notices"
        subtitle="Dashboard notices, exam reminders, and deadlines."
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Notices" },
        ]}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setForm(emptyForm());
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" /> Add Notice
          </Button>
        }
      />

      {notices.length === 0 ? (
        <EmptyState
          title="No notices"
          message="Create your first notice to show it on the student dashboard."
          actionLabel="Add Notice"
          onAction={() => {
            setEditing(null);
            setForm(emptyForm());
            setFormOpen(true);
          }}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground/70">
                  <th scope="col" className="px-4 py-3 font-medium">Notice</th>
                  <th scope="col" className="px-4 py-3 font-medium">Type</th>
                  <th scope="col" className="px-4 py-3 font-medium">Date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {notices.map((n) => {
                  const withState = noticeWithState(n);
                  const semester = n.semesterId ? db.semesters.find((s) => s.id === n.semesterId) : undefined;
                  const subject = n.subjectId ? db.subjects.find((s) => s.id === n.subjectId) : undefined;
                  return (
                    <tr key={n.id} className="transition-colors hover:bg-surface-hover">
                      <td className="max-w-sm px-4 py-3">
                        <div className="flex items-center gap-2">
                          {n.pinned && (
                            <Pin className="size-3.5 shrink-0 fill-current text-primary" aria-hidden="true" />
                          )}
                          <p className="line-clamp-1 font-medium text-foreground">{n.heading}</p>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">{n.subtext}</p>
                        {(semester || subject) && (
                          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground/60">
                            {[semester?.name, subject?.name].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={TYPE_TONE[n.type]}>
                          <span className="capitalize">{n.type}</span>
                        </Badge>
                        <div className="mt-1">
                          <Badge tone={PRIORITY_TONE[n.priority]}>{n.priority} priority</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <p>{formatDate(n.date)}</p>
                        <p
                          className={
                            "mt-0.5 text-xs font-semibold " +
                            (withState.dayState === "today"
                              ? "text-warning"
                              : withState.dayState === "upcoming"
                                ? "text-success"
                                : "text-muted-foreground/70")
                          }
                        >
                          {withState.dayState === "today"
                            ? "Today"
                            : withState.dayState === "upcoming"
                              ? `${withState.dayCount} day${withState.dayCount === 1 ? "" : "s"} remaining`
                              : "Completed"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={n.status} />
                        {!n.showOnDashboard && (
                          <p className="mt-1 text-[11px] font-medium text-muted-foreground/60">Hidden from dashboard</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            icon={n.pinned ? PinOff : Pin}
                            label={n.pinned ? `Unpin ${n.heading}` : `Pin ${n.heading}`}
                            size="sm"
                            variant={n.pinned ? "active" : "default"}
                            onClick={() => toggleNoticePinned(n.id)}
                          />
                          <IconButton
                            icon={n.status === "published" ? EyeOff : Eye}
                            label={n.status === "published" ? `Unpublish ${n.heading}` : `Publish ${n.heading}`}
                            size="sm"
                            onClick={() => setNoticeStatus(n.id, n.status === "published" ? "hidden" : "published")}
                          />
                          <IconButton
                            icon={Pencil}
                            label={`Edit ${n.heading}`}
                            size="sm"
                            onClick={() => openEdit(n)}
                          />
                          <IconButton
                            icon={Trash2}
                            label={`Delete ${n.heading}`}
                            size="sm"
                            variant="danger"
                            onClick={() => setPendingDelete(n)}
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

      {/* Create / edit modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit Notice" : "Add Notice"}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} noValidate className="mt-2 space-y-4">
          <Input
            id="notice-heading"
            label="Heading"
            placeholder="e.g. TU Board Exam — Sem IV"
            value={form.heading}
            onChange={(e) => set("heading", e.target.value)}
            error={errors.heading}
          />
          <Textarea
            id="notice-subtext"
            label="Description / Subtext"
            rows={3}
            placeholder="Details shown under the heading..."
            value={form.subtext}
            onChange={(e) => set("subtext", e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              id="notice-type"
              label="Type"
              value={form.type}
              onChange={(e) => set("type", e.target.value as NoticeType)}
              options={NOTICE_TYPES}
            />
            <Input
              id="notice-date"
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              error={errors.date}
            />
            <Select
              id="notice-priority"
              label="Priority"
              value={form.priority}
              onChange={(e) => set("priority", e.target.value as Notice["priority"])}
              options={[
                { value: "low", label: "Low" },
                { value: "normal", label: "Normal" },
                { value: "high", label: "High" },
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              id="notice-semester"
              label="Semester (optional)"
              value={form.semesterId}
              onChange={(e) => {
                set("semesterId", e.target.value);
                set("subjectId", "");
              }}
              options={[
                { value: "", label: "All semesters" },
                ...db.semesters.filter((s) => !s.deletedAt).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <Select
              id="notice-subject"
              label="Subject (optional)"
              value={form.subjectId}
              disabled={!form.semesterId}
              onChange={(e) => set("subjectId", e.target.value)}
              options={[
                { value: "", label: form.semesterId ? "All subjects" : "Choose a semester first" },
                ...subjects.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-5 rounded-xl border border-border bg-surface-muted/50 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={form.showOnDashboard}
                onChange={(e) => set("showOnDashboard", e.target.checked)}
                className="size-4 rounded border-border-strong text-primary focus:ring-primary/25"
              />
              Show on Dashboard
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => set("pinned", e.target.checked)}
                className="size-4 rounded border-border-strong text-primary focus:ring-primary/25"
              />
              Pinned
            </label>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground">Status</span>
              <Select
                id="notice-status"
                label=""
                value={form.status}
                onChange={(e) => set("status", e.target.value as Notice["status"])}
                options={[
                  { value: "published", label: "Published" },
                  { value: "draft", label: "Draft" },
                  { value: "hidden", label: "Hidden" },
                ]}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Save changes" : "Create notice"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete notice"
        message={`"${pendingDelete?.heading}" will be moved to the trash. You can restore it from there.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            softDelete("notice", pendingDelete.id);
            toast("Notice moved to trash");
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
