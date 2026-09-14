import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell, BookMarked, EyeOff, FileEdit, GraduationCap, Layers, LibraryBig, ListChecks,
  Pencil, Rocket, Send, Trash2, X, type LucideIcon,
} from "lucide-react";
import { PageHeader, Card } from "../../components/common/PageHeader";
import { SearchBar } from "../../components/common/SearchBar";
import { Select, Input, Textarea } from "../../components/common/Field";
import { Button } from "../../components/common/Button";
import { IconButton } from "../../components/common/IconButton";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { Badge } from "../../components/common/Badge";
import { ResourceEditorModal } from "../../components/admin/ResourceEditorModal";
import { useCms } from "../../state/CmsProvider";
import {
  setResourceStatus, setNoticeStatus, setSemesterStatus, setSubjectStatus,
  softDelete, updateTopic, updateNotice,
} from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import { RESOURCE_TYPE_CONFIG, resourceTypeLabel } from "../../lib/resourceType";
import { cx, formatDate, formatRelativeTime } from "../../lib/utils";
import type { Notice, NoticeType, Resource, Semester, Subject, Topic } from "../../types";

type DraftKind = "resource" | "topic" | "notice" | "semester" | "subject";
type KindFilter = DraftKind | "all";

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

const NOTICE_LABEL: Record<NoticeType, string> = {
  exam: "Exam",
  deadline: "Deadline",
  assignment: "Assignment",
  event: "Event",
  important: "Important",
  announcement: "Announcement",
  reminder: "Reminder",
  general: "General",
};

interface DraftRowBase {
  id: string;
  title: string;
  subtitle: string;
  semesterId: string;
  subjectId: string;
  updatedAt: string;
  typeIcon: LucideIcon;
  typeLabel: string;
  typeClass: string;
}

type DraftRow =
  | (DraftRowBase & { kind: "resource"; resource: Resource })
  | (DraftRowBase & { kind: "topic"; topic: Topic })
  | (DraftRowBase & { kind: "notice"; notice: Notice })
  | (DraftRowBase & { kind: "semester"; semester: Semester })
  | (DraftRowBase & { kind: "subject"; subject: Subject });

interface TopicEditState {
  title: string;
  description: string;
  order: string;
  status: Topic["status"];
}

interface NoticeEditState {
  heading: string;
  subtext: string;
  type: NoticeType;
  date: string;
  semesterId: string;
  subjectId: string;
  priority: Notice["priority"];
  showOnDashboard: boolean;
  pinned: boolean;
}

const TOPIC_STATUS_OPTIONS = [
  { value: "draft", label: "Draft", icon: FileEdit, active: "bg-warning text-white" },
  { value: "published", label: "Published", icon: Send, active: "bg-success text-white" },
  { value: "hidden", label: "Hidden", icon: EyeOff, active: "bg-secondary text-white" },
] as const;

function StatTile({ label, value, icon: Icon, iconClass }: {
  label: string;
  value: number;
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

function KindChip({ active, label, count, onClick }: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border-strong bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
      )}
    >
      {label}
      <span className={cx("ml-1.5 tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground/70")}>
        {count}
      </span>
    </button>
  );
}

export default function AdminDrafts() {
  const db = useCms();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [topicEdit, setTopicEdit] = useState<Topic | null>(null);
  const [topicForm, setTopicForm] = useState<TopicEditState>({ title: "", description: "", order: "1", status: "draft" });
  const [topicErrors, setTopicErrors] = useState<Partial<Record<"title" | "order", string>>>({});
  const [noticeEdit, setNoticeEdit] = useState<Notice | null>(null);
  const [noticeForm, setNoticeForm] = useState<NoticeEditState>({
    heading: "", subtext: "", type: "announcement", date: "",
    semesterId: "", subjectId: "", priority: "normal", showOnDashboard: true, pinned: false,
  });
  const [noticeErrors, setNoticeErrors] = useState<Partial<Record<"heading" | "date", string>>>({});
  const [pendingPublish, setPendingPublish] = useState<DraftRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DraftRow | null>(null);

  const semesters = useMemo(
    () => db.semesters.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order),
    [db.semesters],
  );
  const semesterById = useMemo(() => new Map(semesters.map((s) => [s.id, s])), [semesters]);
  const subjectsAll = useMemo(
    () => db.subjects.filter((s) => !s.deletedAt),
    [db.subjects],
  );
  const subjectById = useMemo(() => new Map(subjectsAll.map((s) => [s.id, s])), [subjectsAll]);

  const rows = useMemo<DraftRow[]>(() => {
    const draftResources = db.resources
      .filter((r) => !r.deletedAt && r.status === "draft")
      .map((r): DraftRow => {
        const cfg = RESOURCE_TYPE_CONFIG[r.type];
        return {
          kind: "resource",
          id: r.id,
          resource: r,
          title: r.title,
          subtitle: r.description,
          semesterId: r.semesterId,
          subjectId: r.subjectId,
          updatedAt: r.updatedAt,
          typeIcon: cfg.icon,
          typeLabel: resourceTypeLabel(r.type),
          typeClass: cfg.badgeClass,
        };
      });
    const draftTopics = db.topics
      .filter((t) => !t.deletedAt && t.status === "draft")
      .map((t): DraftRow => ({
        kind: "topic",
        id: t.id,
        topic: t,
        title: t.title,
        subtitle: t.description ?? "",
        semesterId: subjectById.get(t.subjectId)?.semesterId ?? "",
        subjectId: t.subjectId,
        updatedAt: t.updatedAt,
        typeIcon: ListChecks,
        typeLabel: "Topic",
        typeClass: "bg-accent/15 text-accent",
      }));
    const draftNotices = db.notices
      .filter((n) => !n.deletedAt && n.status === "draft")
      .map((n): DraftRow => ({
        kind: "notice",
        id: n.id,
        notice: n,
        title: n.heading,
        subtitle: n.subtext,
        semesterId: n.semesterId ?? "",
        subjectId: n.subjectId ?? "",
        updatedAt: n.updatedAt,
        typeIcon: Bell,
        typeLabel: `${NOTICE_LABEL[n.type]} Notice`,
        typeClass: "bg-warning-muted text-warning",
      }));
    const draftSemesters = db.semesters
      .filter((s) => !s.deletedAt && s.status === "draft")
      .map((s): DraftRow => ({
        kind: "semester",
        id: s.id,
        semester: s,
        title: s.name,
        subtitle: s.description,
        semesterId: s.id,
        subjectId: "",
        updatedAt: s.updatedAt,
        typeIcon: GraduationCap,
        typeLabel: "Semester",
        typeClass: "bg-secondary/15 text-secondary",
      }));
    const draftSubjects = db.subjects
      .filter((s) => !s.deletedAt && s.status === "draft")
      .map((s): DraftRow => ({
        kind: "subject",
        id: s.id,
        subject: s,
        title: s.name,
        subtitle: s.description,
        semesterId: s.semesterId,
        subjectId: s.id,
        updatedAt: s.updatedAt,
        typeIcon: BookMarked,
        typeLabel: "Subject",
        typeClass: "bg-success-muted text-success",
      }));
    return [...draftResources, ...draftTopics, ...draftNotices, ...draftSemesters, ...draftSubjects].sort(
      (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
    );
  }, [db.resources, db.topics, db.notices, db.semesters, db.subjects, subjectById]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      resources: rows.filter((r) => r.kind === "resource").length,
      topics: rows.filter((r) => r.kind === "topic").length,
      notices: rows.filter((r) => r.kind === "notice").length,
      semesters: rows.filter((r) => r.kind === "semester").length,
      subjects: rows.filter((r) => r.kind === "subject").length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;
    if (kindFilter !== "all") list = list.filter((r) => r.kind === kindFilter);
    if (q) {
      list = list.filter(
        (r) => r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q),
      );
    }
    if (semesterFilter) list = list.filter((r) => r.semesterId === semesterFilter);
    if (subjectFilter) list = list.filter((r) => r.subjectId === subjectFilter);
    return list;
  }, [rows, kindFilter, query, semesterFilter, subjectFilter]);

  const subjectOptions = useMemo(
    () => (semesterFilter ? subjectsAll.filter((s) => s.semesterId === semesterFilter) : subjectsAll),
    [subjectsAll, semesterFilter],
  );

  const noticeSubjects = useMemo(
    () => (noticeForm.semesterId ? subjectsAll.filter((s) => s.semesterId === noticeForm.semesterId) : []),
    [subjectsAll, noticeForm.semesterId],
  );

  const anyFilterActive =
    query.trim() !== "" || kindFilter !== "all" || semesterFilter !== "" || subjectFilter !== "";

  const clearFilters = () => {
    setQuery("");
    setKindFilter("all");
    setSemesterFilter("");
    setSubjectFilter("");
  };

  const openTopicEdit = (t: Topic) => {
    setTopicEdit(t);
    setTopicErrors({});
    setTopicForm({
      title: t.title,
      description: t.description ?? "",
      order: String(t.order),
      status: t.status,
    });
  };

  const saveTopic = (status: Topic["status"]) => {
    if (!topicEdit) return;
    const next: typeof topicErrors = {};
    if (!topicForm.title.trim()) next.title = "Topic name is required.";
    if (!topicForm.order || Number(topicForm.order) < 1) next.order = "Order must be â‰¥ 1.";
    setTopicErrors(next);
    if (Object.keys(next).length > 0) return;
    updateTopic(topicEdit.id, {
      subjectId: topicEdit.subjectId,
      title: topicForm.title.trim(),
      description: topicForm.description.trim(),
      order: Number(topicForm.order),
      status,
    });
    toast(status === "published" ? `"${topicForm.title.trim()}" published` : "Draft topic updated");
    setTopicEdit(null);
  };

  const openNoticeEdit = (n: Notice) => {
    setNoticeEdit(n);
    setNoticeErrors({});
    setNoticeForm({
      heading: n.heading,
      subtext: n.subtext,
      type: n.type,
      date: n.date.slice(0, 10),
      semesterId: n.semesterId ?? "",
      subjectId: n.subjectId ?? "",
      priority: n.priority,
      showOnDashboard: n.showOnDashboard,
      pinned: n.pinned,
    });
  };

  const saveNotice = (status: Notice["status"]) => {
    if (!noticeEdit) return;
    const next: typeof noticeErrors = {};
    if (!noticeForm.heading.trim()) next.heading = "Title is required.";
    if (!noticeForm.date) next.date = "Date is required.";
    setNoticeErrors(next);
    if (Object.keys(next).length > 0) return;
    updateNotice(noticeEdit.id, {
      heading: noticeForm.heading.trim(),
      subtext: noticeForm.subtext.trim(),
      type: noticeForm.type,
      date: new Date(`${noticeForm.date}T00:00:00`).toISOString(),
      semesterId: noticeForm.semesterId || undefined,
      subjectId: noticeForm.subjectId || undefined,
      priority: noticeForm.priority,
      showOnDashboard: noticeForm.showOnDashboard,
      pinned: noticeForm.pinned,
      status,
    });
    toast(status === "published" ? `"${noticeForm.heading.trim()}" published` : "Draft notice updated");
    setNoticeEdit(null);
  };

  const idOf = (row: DraftRow): string =>
    row.kind === "resource" ? row.resource.id
      : row.kind === "topic" ? row.topic.id
        : row.kind === "notice" ? row.notice.id
          : row.kind === "semester" ? row.semester.id
            : row.subject.id;

  /** Row/card click action: resources open their detail page; topics and
   *  notices open their edit modal; semester/subject drafts have no detail
   *  view, so clicking them does nothing. */
  const openDraft = (row: DraftRow) => {
    if (row.kind === "resource") navigate(`/admin/resources/${row.resource.id}`);
    else if (row.kind === "topic") openTopicEdit(row.topic);
    else if (row.kind === "notice") openNoticeEdit(row.notice);
  };

  const publishRow = (row: DraftRow) => {
    if (row.kind === "resource") setResourceStatus(row.resource.id, "published");
    else if (row.kind === "topic") updateTopic(row.topic.id, { status: "published" });
    else if (row.kind === "semester") setSemesterStatus(row.semester.id, "published");
    else if (row.kind === "subject") setSubjectStatus(row.subject.id, "published");
    else setNoticeStatus(row.notice.id, "published");
    toast(`"${row.title}" published`);
    setPendingPublish(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Drafts"
        subtitle="Unpublished content across the library â€” review, edit, and publish when ready."
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Drafts" },
        ]}
        actions={
          <Badge tone="warning">
            <FileEdit className="size-3.5" aria-hidden="true" /> {stats.total} drafts
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total Drafts" value={stats.total} icon={FileEdit} iconClass="bg-warning-muted text-warning" />
        <StatTile label="Resources" value={stats.resources} icon={LibraryBig} iconClass="bg-primary-muted text-primary" />
        <StatTile label="Topics" value={stats.topics} icon={ListChecks} iconClass="bg-accent/15 text-accent" />
        <StatTile label="Notices" value={stats.notices} icon={Bell} iconClass="bg-secondary/15 text-secondary" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          placeholder="Search drafts..."
          className="w-full sm:max-w-md sm:flex-1"
          onSubmit={setQuery}
          onChange={setQuery}
        />
        <div className="flex gap-3 sm:flex-wrap">
          <Select
            id="drafts-semester-filter"
            label=""
            value={semesterFilter}
            onChange={(e) => {
              setSemesterFilter(e.target.value);
              setSubjectFilter("");
            }}
            className={cx("min-w-0 flex-1 sm:w-44 sm:flex-none", semesterFilter && "[&>select]:border-primary/60 [&>select]:bg-primary-muted/40 [&>select]:font-semibold")}
            aria-label="Filter by semester"
            options={[
              { value: "", label: "All Semesters" },
              ...semesters.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <Select
            id="drafts-subject-filter"
            label=""
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className={cx("min-w-0 flex-1 sm:w-48 sm:flex-none", subjectFilter && "[&>select]:border-primary/60 [&>select]:bg-primary-muted/40 [&>select]:font-semibold")}
            aria-label="Filter by subject"
            options={[
              { value: "", label: "All Subjects" },
              ...subjectOptions.map((s) => ({ value: s.id, label: `${s.code} â€” ${s.name}` })),
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

      <div
        role="group"
        aria-label="Filter by content type"
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <KindChip active={kindFilter === "all"} label="All" count={stats.total} onClick={() => setKindFilter("all")} />
        <KindChip active={kindFilter === "resource"} label="Resources" count={stats.resources} onClick={() => setKindFilter("resource")} />
        <KindChip active={kindFilter === "topic"} label="Topics" count={stats.topics} onClick={() => setKindFilter("topic")} />
        <KindChip active={kindFilter === "semester"} label="Semesters" count={stats.semesters} onClick={() => setKindFilter("semester")} />
        <KindChip active={kindFilter === "notice"} label="Notices" count={stats.notices} onClick={() => setKindFilter("notice")} />
        <KindChip active={kindFilter === "subject"} label="Subjects" count={stats.subjects} onClick={() => setKindFilter("subject")} />
      </div>

      {stats.total === 0 ? (
        <EmptyState
          title="No drafts"
          message="Everything is published. Set any item's status to Draft to stage it here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No drafts match"
          message={query ? `Nothing matched "${query}".` : "No drafts match the current filters."}
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed min-w-[1000px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-[11px] uppercase tracking-wider text-muted-foreground/80">
                    <th scope="col" className="w-[29%] px-4 py-3 font-semibold">Content</th>
                    <th scope="col" className="w-[16%] px-3 py-3 font-semibold">Type</th>
                    <th scope="col" className="w-[11%] px-3 py-3 font-semibold">Semester</th>
                    <th scope="col" className="w-[14%] px-3 py-3 font-semibold">Subject</th>
                    <th scope="col" className="w-[11%] px-3 py-3 font-semibold">Last Updated</th>
                    <th scope="col" className="w-[19%] px-3 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((row) => {
                    const TypeIcon = row.typeIcon;
                    const subject = subjectById.get(row.subjectId);
                    const semester = semesterById.get(row.semesterId);
                    return (
                      <tr
                        key={`${row.kind}-${idOf(row)}`}
                        onClick={() => openDraft(row)}
                        className={cx(
                          "transition-colors hover:bg-surface-hover",
                          (row.kind === "resource" || row.kind === "topic" || row.kind === "notice")
                            ? "cursor-pointer"
                            : "cursor-default",
                        )}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={cx("flex size-9 shrink-0 items-center justify-center rounded-lg", row.typeClass)}>
                              <TypeIcon className="size-4" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              {row.kind === "resource" ? (
                                <Link
                                  to={`/admin/resources/${row.resource.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="truncate font-semibold text-foreground hover:text-primary"
                                >
                                  {row.title}
                                </Link>
                              ) : (
                                <p className="truncate font-semibold text-foreground">{row.title}</p>
                              )}
                              {row.subtitle && (
                                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/80">
                                  {row.subtitle}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", row.typeClass)}>
                            {row.typeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground">
                          {semester?.name ?? "â€”"}
                        </td>
                        <td className="max-w-[200px] px-4 py-3.5">
                          <p className="truncate text-sm text-foreground/80">{subject?.name ?? "â€”"}</p>
                          {subject && (
                            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">{subject.code}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-xs font-medium text-foreground/80">{formatDate(row.updatedAt)}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                            {formatRelativeTime(row.updatedAt)}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingPublish(row);
                              }}
                            >
                              <Rocket className="size-3.5" aria-hidden="true" /> Publish
                            </Button>
                            {(row.kind === "resource" || row.kind === "topic" || row.kind === "notice") && (
                              <IconButton
                                icon={Pencil}
                                label={`Edit ${row.title}`}
                                size="sm"
                                className="border border-border bg-surface"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (row.kind === "resource") setEditingResource(row.resource);
                                  else if (row.kind === "topic") openTopicEdit(row.topic);
                                  else openNoticeEdit(row.notice);
                                }}
                              />
                            )}
                            <IconButton
                              icon={Trash2}
                              label={`Delete ${row.title}`}
                              size="sm"
                              variant="danger"
                              className="border border-border bg-surface"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete(row);
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

          <div className="space-y-3 md:hidden">
            {filtered.map((row) => {
              const TypeIcon = row.typeIcon;
              const subject = subjectById.get(row.subjectId);
              const semester = semesterById.get(row.semesterId);
              return (
                <Card
                  key={`${row.kind}-${idOf(row)}`}
                  className="p-4"
                  onClick={(row.kind === "resource" || row.kind === "topic" || row.kind === "notice") ? () => openDraft(row) : undefined}
                >
                  <div className="flex items-start gap-3">
                    <div className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", row.typeClass)}>
                      <TypeIcon className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {row.kind === "resource" ? (
                        <Link
                          to={`/admin/resources/${row.resource.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="truncate text-sm font-bold text-foreground hover:text-primary"
                        >
                          {row.title}
                        </Link>
                      ) : (
                        <p className="truncate text-sm font-bold text-foreground">{row.title}</p>
                      )}
                      {row.subtitle && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{row.subtitle}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground/80">
                        {semester?.name ?? "â€”"} Â· {subject?.name ?? "â€”"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", row.typeClass)}>
                      {row.typeLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      <Layers className="size-3.5" aria-hidden="true" />
                      {formatRelativeTime(row.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingPublish(row);
                      }}
                    >
                      <Rocket className="size-3.5" aria-hidden="true" /> Publish
                    </Button>
                    <div className="flex items-center gap-1.5">
                      {(row.kind === "resource" || row.kind === "topic" || row.kind === "notice") && (
                        <IconButton
                          icon={Pencil}
                          label={`Edit ${row.title}`}
                          size="sm"
                          className="border border-border bg-surface"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (row.kind === "resource") setEditingResource(row.resource);
                            else if (row.kind === "topic") openTopicEdit(row.topic);
                            else openNoticeEdit(row.notice);
                          }}
                        />
                      )}
                      <IconButton
                        icon={Trash2}
                        label={`Delete ${row.title}`}
                        size="sm"
                        variant="danger"
                        className="border border-border bg-surface"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDelete(row);
                        }}
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <ResourceEditorModal
        open={editingResource !== null}
        editing={editingResource ?? undefined}
        onClose={() => setEditingResource(null)}
      />

      <Modal
        open={topicEdit !== null}
        onClose={() => setTopicEdit(null)}
        title="Edit Topic"
        className="max-w-lg"
      >
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            saveTopic(topicForm.status);
          }}
          noValidate
          className="mt-2 space-y-4"
        >
          <div className="rounded-xl border border-border bg-surface-muted/60 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Subject</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {topicEdit
                ? (() => {
                    const s = subjectById.get(topicEdit.subjectId);
                    return s ? `${s.code} â€” ${s.name}` : "â€”";
                  })()
                : "â€”"}
            </p>
          </div>
          <Input
            id="draft-topic-title"
            label="Topic Name"
            placeholder="e.g. Normalization"
            value={topicForm.title}
            onChange={(e) => setTopicForm((p) => ({ ...p, title: e.target.value }))}
            error={topicErrors.title}
          />
          <Textarea
            id="draft-topic-description"
            label="Description (optional)"
            rows={3}
            placeholder="Short description shown in the accordion..."
            value={topicForm.description}
            onChange={(e) => setTopicForm((p) => ({ ...p, description: e.target.value }))}
          />
          <Input
            id="draft-topic-order"
            label="Order"
            type="number"
            min={1}
            value={topicForm.order}
            onChange={(e) => setTopicForm((p) => ({ ...p, order: e.target.value }))}
            error={topicErrors.order}
          />
          <div>
            <span className="block text-sm font-semibold text-foreground">Status</span>
            <div role="group" aria-label="Topic status" className="mt-1.5 flex flex-wrap gap-2">
              {TOPIC_STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={topicForm.status === opt.value}
                  onClick={() => setTopicForm((p) => ({ ...p, status: opt.value }))}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    topicForm.status === opt.value
                      ? opt.active
                      : "border border-border-strong bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  <opt.icon className="size-3.5" aria-hidden="true" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button variant="ghost" type="button" onClick={() => setTopicEdit(null)}>
              Cancel
            </Button>
            <Button variant="outline" type="submit">
              Save as Draft
            </Button>
            <Button variant="secondary" type="button" onClick={() => saveTopic("published")}>
              <Send className="size-4" aria-hidden="true" /> Save &amp; Publish
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={noticeEdit !== null}
        onClose={() => setNoticeEdit(null)}
        title="Edit Notice"
        className="max-w-lg"
      >
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            saveNotice("draft");
          }}
          noValidate
          className="mt-2 space-y-4"
        >
          <Input
            id="draft-notice-heading"
            label="Notice Title"
            placeholder="e.g. TU Board Exam â€” Sem IV"
            value={noticeForm.heading}
            onChange={(e) => setNoticeForm((p) => ({ ...p, heading: e.target.value }))}
            error={noticeErrors.heading}
          />
          <Textarea
            id="draft-notice-subtext"
            label="Description"
            rows={3}
            placeholder="Details shown under the heading..."
            value={noticeForm.subtext}
            onChange={(e) => setNoticeForm((p) => ({ ...p, subtext: e.target.value }))}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              id="draft-notice-type"
              label="Notice Type"
              value={noticeForm.type}
              onChange={(e) => setNoticeForm((p) => ({ ...p, type: e.target.value as NoticeType }))}
              options={NOTICE_TYPES}
            />
            <Input
              id="draft-notice-date"
              label="Date"
              type="date"
              value={noticeForm.date}
              onChange={(e) => setNoticeForm((p) => ({ ...p, date: e.target.value }))}
              error={noticeErrors.date}
            />
            <Select
              id="draft-notice-priority"
              label="Priority"
              value={noticeForm.priority}
              onChange={(e) => setNoticeForm((p) => ({ ...p, priority: e.target.value as Notice["priority"] }))}
              options={[
                { value: "low", label: "Low" },
                { value: "normal", label: "Normal" },
                { value: "high", label: "High" },
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              id="draft-notice-semester"
              label="Semester (optional)"
              value={noticeForm.semesterId}
              onChange={(e) => setNoticeForm((p) => ({ ...p, semesterId: e.target.value, subjectId: "" }))}
              options={[
                { value: "", label: "All semesters" },
                ...semesters.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <Select
              id="draft-notice-subject"
              label="Subject (optional)"
              value={noticeForm.subjectId}
              disabled={!noticeForm.semesterId}
              onChange={(e) => setNoticeForm((p) => ({ ...p, subjectId: e.target.value }))}
              options={[
                { value: "", label: noticeForm.semesterId ? "All subjects" : "Choose a semester first" },
                ...noticeSubjects.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-5 rounded-xl border border-border bg-surface-muted/50 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={noticeForm.showOnDashboard}
                onChange={(e) => setNoticeForm((p) => ({ ...p, showOnDashboard: e.target.checked }))}
                className="size-4 rounded border-border-strong text-primary focus:ring-primary/25"
              />
              Show on Dashboard
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={noticeForm.pinned}
                onChange={(e) => setNoticeForm((p) => ({ ...p, pinned: e.target.checked }))}
                className="size-4 rounded border-border-strong text-primary focus:ring-primary/25"
              />
              Pinned
            </label>
          </div>
          <div className="flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button variant="ghost" type="button" onClick={() => setNoticeEdit(null)}>
              Cancel
            </Button>
            <Button variant="outline" type="submit">
              Save as Draft
            </Button>
            <Button variant="secondary" type="button" onClick={() => saveNotice("published")}>
              <Rocket className="size-4" aria-hidden="true" /> Save &amp; Publish
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingPublish !== null}
        title="Publish draft"
        message={`"${pendingPublish?.title}" will be published and immediately visible to students.`}
        confirmLabel="Publish"
        onCancel={() => setPendingPublish(null)}
        onConfirm={() => {
          if (pendingPublish) publishRow(pendingPublish);
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete draft"
        message={`"${pendingDelete?.title}" will move to the trash. You can restore it from Trash, or delete it permanently there.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            softDelete(
              pendingDelete.kind,
              pendingDelete.kind === "resource"
                ? pendingDelete.resource.id
                : pendingDelete.kind === "topic"
                  ? pendingDelete.topic.id
                  : pendingDelete.kind === "notice"
                    ? pendingDelete.notice.id
                    : pendingDelete.kind === "semester"
                      ? pendingDelete.semester.id
                      : pendingDelete.subject.id,
            );
            toast("Draft moved to trash");
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
