import { useMemo, useState, type FormEvent } from "react";
import { Pin, PinOff, Trash2, Pencil, Plus, Search } from "lucide-react";
import { PageHeader, Card } from "../../components/common/PageHeader";
import { Input, Select, Textarea } from "../../components/common/Field";
import { Button } from "../../components/common/Button";
import { IconButton } from "../../components/common/IconButton";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { StatusBadge, StatusToggleGroup } from "../../components/admin/StatusBadge";
import { NoticeDetailModal } from "../../components/notices/NoticeDetailModal";
import { Badge } from "../../components/common/Badge";
import { useCms } from "../../state/CmsProvider";
import {
  createNotice, updateNotice, branchNoticeToDraft, toggleNoticePinned,
  deleteEntity, getSettings, noticeWithState,
} from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import { cx, formatDate } from "../../lib/utils";
import type { Notice, NoticeType, NoticeAnnouncer } from "../../types";

const NOTICE_TYPES: { value: NoticeType; label: string }[] = [
  { value: "exam", label: "Exam" },
  { value: "deadline", label: "Deadline" },
  { value: "assignment", label: "Assignment" },
  { value: "event", label: "Event" },
  { value: "important", label: "Important" },
  { value: "announcement", label: "Announcement" },
  { value: "reminder", label: "Reminder" },
  { value: "general", label: "General" },
];

const ANNOUNCER_OPTIONS: { value: NoticeAnnouncer; label: string }[] = [
  { value: "administration", label: "Administration" },
  { value: "csit-department", label: "CSIT Department" },
  { value: "examination", label: "Examination Section" },
  { value: "library", label: "Library" },
];

const ANNOUNCER_LABEL: Record<NoticeAnnouncer, string> = {
  administration: "Administration",
  "csit-department": "CSIT Department",
  examination: "Examination Section",
  library: "Library",
};

const TYPE_TONE: Record<NoticeType, "error" | "warning" | "primary" | "accent" | "neutral"> = {
  exam: "error",
  deadline: "warning",
  assignment: "warning",
  event: "accent",
  important: "error",
  announcement: "primary",
  reminder: "accent",
  general: "neutral",
};

const PRIORITY_TONE: Record<Notice["priority"], "success" | "warning" | "error"> = {
  low: "success",
  normal: "warning",
  high: "error",
  urgent: "error",
};

interface NoticeFormState {
  heading: string;
  subtext: string;
  type: NoticeType;
  announcer: NoticeAnnouncer;
  date: string;
  priority: Notice["priority"];
  status: Notice["status"];
  showOnDashboard: boolean;
  pinned: boolean;
}

const emptyForm = (): NoticeFormState => {
  const s = getSettings().notices;
  return {
    heading: "",
    subtext: "",
    type: s.defaultNoticeType,
    announcer: "administration",
    date: new Date().toISOString().slice(0, 10),
    priority: s.defaultPriority,
    status: "published",
    showOnDashboard: s.showOnDashboard,
    pinned: false,
  };
};

export default function AdminNotices() {
  const db = useCms();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<NoticeType | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form, setForm] = useState<NoticeFormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof NoticeFormState, string>>>({});
  const [pendingDelete, setPendingDelete] = useState<Notice | null>(null);
  const [detail, setDetail] = useState<Notice | null>(null);

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

  const counts = useMemo(() => {
    const byType: Partial<Record<NoticeType, number>> = {};
    for (const n of notices) byType[n.type] = (byType[n.type] ?? 0) + 1;
    return byType;
  }, [notices]);

  /** Search + type filter chips. */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notices.filter((n) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (!q) return true;
      return (
        n.heading.toLowerCase().includes(q) ||
        n.subtext.toLowerCase().includes(q)
      );
    });
  }, [notices, query, typeFilter]);

  const openForm = () => {
    setEditing(null);
    setForm(emptyForm());
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (n: Notice) => {
    setEditing(n);
    setForm({
      heading: n.heading,
      subtext: n.subtext,
      type: n.type,
      announcer: n.announcer,
      date: n.date.slice(0, 10),
      priority: n.priority,
      status: n.status,
      showOnDashboard: n.showOnDashboard,
      pinned: n.pinned,
    });
    setErrors({});
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setErrors({});
  };

  /** Delete honoring settings: skip the confirmation when
   *  "Confirm Before Deleting" is OFF, and permanently delete when
   *  "Move Deleted to Trash" is OFF. */
  const requestDelete = (n: Notice) => {
    const s = getSettings();
    if (!s.contentDefaults.confirmDelete) {
      deleteEntity("notice", n.id);
      toast(
        s.draftTrash.moveDeletedToTrash
          ? "Notice moved to trash"
          : "Notice permanently deleted",
      );
      return;
    }
    setPendingDelete(n);
  };

  const set = <K extends keyof NoticeFormState>(key: K, value: NoticeFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!form.heading.trim()) next.heading = "Title is required.";
    if (!form.date) next.date = "Date is required.";
    if (!form.announcer) (next as any).announcer = "Announcer is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = (status: Notice["status"]) => {
    if (!validate()) return;
    const draft = {
      heading: form.heading.trim(),
      subtext: form.subtext.trim(),
      type: form.type,
      announcer: form.announcer,
      date: new Date(`${form.date}T00:00:00`).toISOString(),
      priority: form.priority,
      status,
      showOnDashboard: form.showOnDashboard,
      pinned: form.pinned,
    };
    if (editing) {
      // Editing a published notice + Save as Draft → keep the live
      // version untouched and stage the edits as a new draft in Drafts.
      if (status === "draft" && editing.status !== "draft") {
        branchNoticeToDraft(editing.id, draft);
        toast("Edits saved as a new draft — the published notice is unchanged");
      } else {
        updateNotice(editing.id, draft);
        toast("Notice updated");
      }
    } else {
      createNotice(draft);
      toast(status === "draft" ? "Notice saved as draft" : "Notice published");
    }
    setFormOpen(false);
    setEditing(null);
    setErrors({});
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
          <Button onClick={openForm}>
            <Plus className="size-4" aria-hidden="true" /> Add Notice
          </Button>
        }
      />

      {/* Filter bar: search + type chips */}
      <div className="mb-5">
        <div className="relative mb-3 max-w-md">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notices..."
            aria-label="Search notices"
            className="h-10 w-full rounded-lg border border-border-strong bg-surface-muted pl-10 pr-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 focus:bg-surface"
          />
        </div>
        <div
          role="group"
          aria-label="Filter by notice type"
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {(["all", ...NOTICE_TYPES.map((t) => t.value)] as const).map((chip) => {
            const isActive = typeFilter === chip;
            const count = chip === "all" ? notices.length : counts[chip];
            const label = chip === "all" ? "All" : NOTICE_TYPES.find((t) => t.value === chip)!.label;
            return (
              <button
                key={chip}
                type="button"
                aria-pressed={isActive}
                onClick={() => setTypeFilter(chip)}
                className={cx(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "border border-border-strong bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {label}
                <span className={cx("ml-1 font-bold", isActive ? "opacity-80" : "text-primary")}>
                  {count ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={query || typeFilter !== "all" ? "No notices match" : "No notices"}
          message={
            query || typeFilter !== "all"
              ? "No notices match the current filters. Try a different search or filter."
              : "Create your first notice to show it on the student dashboard."
          }
          actionLabel="Add Notice"
          onAction={openForm}
        />
      ) : (
        <>
          {/* Desktop / Tablet — keep existing table exactly as-is */}
          <Card className="hidden overflow-hidden md:block">
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
                  {filtered.map((n) => {
                    const withState = noticeWithState(n);
                    return (
                      <tr
                        key={n.id}
                        onClick={() => setDetail(n)}
                        className="cursor-pointer transition-colors hover:bg-surface-hover"
                      >
                        <td className="max-w-sm px-4 py-3">
                          <div className="flex items-center gap-2">
                            {n.pinned && (
                              <Pin className="size-3.5 shrink-0 fill-current text-primary" aria-hidden="true" />
                            )}
                            <p className="line-clamp-1 font-medium text-foreground">{n.heading}</p>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">{n.subtext}</p>
                          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground/60">
                            {ANNOUNCER_LABEL[n.announcer] ?? n.announcer}
                          </p>
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
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleNoticePinned(n.id);
                              }}
                            />
                            <IconButton
                              icon={Pencil}
                              label={`Edit ${n.heading}`}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(n);
                              }}
                            />
                            <IconButton
                              icon={Trash2}
                              label={`Delete ${n.heading}`}
                              size="sm"
                              variant="danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDelete(n);
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

          {/* Mobile — full-width row-cards (no horizontal scroll) */}
          <div className="space-y-3 md:hidden">
            {filtered.map((n) => {
              const withState = noticeWithState(n);
              return (
                <div
                  key={n.id}
                  onClick={() => setDetail(n)}
                  className="w-full max-w-full cursor-pointer overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:bg-surface-hover"
                >
                  {/* Notice heading + subtext (same hierarchy as table) */}
                  <div className="min-w-0">
                    <div className="flex items-start gap-2">
                      {n.pinned && (
                        <Pin className="mt-0.5 size-3.5 shrink-0 fill-current text-primary" aria-hidden="true" />
                      )}
                      <p className="min-w-0 flex-1 break-words text-sm font-medium leading-snug text-foreground">
                        {n.heading}
                      </p>
                    </div>
                    {n.subtext && (
                      <p className="mt-1.5 truncate text-[13px] leading-relaxed text-muted-foreground/80">
                        {n.subtext}
                      </p>
                    )}
                    <p className="mt-1 break-words text-[11px] font-medium leading-tight text-muted-foreground/60">
                      {ANNOUNCER_LABEL[n.announcer] ?? n.announcer}
                    </p>
                  </div>

                  {/* Type + priority badges + date (wrapped, no overflow) */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone={TYPE_TONE[n.type]}>
                      <span className="capitalize">{n.type}</span>
                    </Badge>
                    <Badge tone={PRIORITY_TONE[n.priority]}>{n.priority} priority</Badge>
                    <span className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-right text-xs font-medium text-muted-foreground">
                      <span className="whitespace-nowrap">{formatDate(n.date)}</span>
                      <span
                        className={cx(
                          "whitespace-nowrap text-xs font-semibold",
                          withState.dayState === "today"
                            ? "text-warning"
                            : withState.dayState === "upcoming"
                              ? "text-success"
                              : "text-muted-foreground/70",
                        )}
                      >
                        {withState.dayState === "today"
                          ? "Today"
                          : withState.dayState === "upcoming"
                            ? `${withState.dayCount} day${withState.dayCount === 1 ? "" : "s"} remaining`
                            : "Completed"}
                      </span>
                    </span>
                  </div>

                  {/* Status + actions (border-separated footer) */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="min-w-0">
                      <StatusBadge status={n.status} />
                      {!n.showOnDashboard && (
                        <p className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground/60">
                          Hidden from dashboard
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton
                        icon={n.pinned ? PinOff : Pin}
                        label={n.pinned ? `Unpin ${n.heading}` : `Pin ${n.heading}`}
                        size="sm"
                        variant={n.pinned ? "active" : "default"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleNoticePinned(n.id);
                        }}
                      />
                      <IconButton
                        icon={Pencil}
                        label={`Edit ${n.heading}`}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(n);
                        }}
                      />
                      <IconButton
                        icon={Trash2}
                        label={`Delete ${n.heading}`}
                        size="sm"
                        variant="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDelete(n);
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Create / edit modal — compact, centered */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit Notice" : "Add Notice"}
        className="max-w-lg"
      >
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); save(form.status); }} noValidate className="mt-2 space-y-4">
            <Input
              id="notice-heading"
              label="Title"
              placeholder="e.g. TU Board Exam — Sem IV"
              value={form.heading}
              onChange={(e) => set("heading", e.target.value)}
              error={errors.heading}
            />
            <Textarea
              id="notice-subtext"
              label="Description"
              rows={3}
              placeholder="Details shown under the heading..."
              value={form.subtext}
              onChange={(e) => set("subtext", e.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                id="notice-type"
                label="Notice Type"
                value={form.type}
                onChange={(e) => set("type", e.target.value as NoticeType)}
                options={NOTICE_TYPES}
              />
              <Select
                id="notice-announcer"
                label="Announcer"
                value={form.announcer}
                onChange={(e) => set("announcer", e.target.value as NoticeAnnouncer)}
                options={ANNOUNCER_OPTIONS}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="notice-date"
                label="Notice Date"
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
                Pin to Dashboard
              </label>
            </div>
            <div className="space-y-1.5">
              <span className="block text-sm font-semibold text-foreground">Status</span>
              <div className="flex h-10 items-center">
                <StatusToggleGroup
                  value={form.status}
                  onChange={(s) => {
                    if (s === "draft" || s === "published") set("status", s);
                  }}
                  options={["draft", "published"]}
                  size="md"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {form.status === "draft"
                  ? "Drafts stay in Admin only."
                  : "Published notices appear to students."}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="submit" className="w-full sm:w-auto sm:flex-1 whitespace-nowrap">
                {form.status === "draft" ? "Save Draft" : "Save & Publish"}
              </Button>
              <Button variant="outline" type="button" onClick={closeForm} className="w-full sm:w-auto sm:flex-1 whitespace-nowrap">
                Cancel
              </Button>
            </div>
          </form>
      </Modal>

      {detail !== null && (
        <NoticeDetailModal notice={detail} open onClose={() => setDetail(null)} />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete notice"
        message={
          getSettings().draftTrash.moveDeletedToTrash
            ? `"${pendingDelete?.heading}" will be moved to the trash. You can restore it from there.`
            : `"${pendingDelete?.heading}" will be permanently deleted. This cannot be undone.`
        }
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteEntity("notice", pendingDelete.id);
            toast(
              getSettings().draftTrash.moveDeletedToTrash
                ? "Notice moved to trash"
                : "Notice permanently deleted",
            );
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
