import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BookMarked, CheckCircle2, ChevronDown, CloudUpload, EyeOff, FileEdit, FileText, FileUp,
  FolderOpen, Info, ListChecks, Pencil, Plus, RotateCcw, Send, Trash2, X,
} from "lucide-react";

import { PageHeader, Card, StatCard } from "../../components/common/PageHeader";
import { Badge } from "../../components/common/Badge";
import { Input, Select, Textarea } from "../../components/common/Field";
import { Button } from "../../components/common/Button";
import { IconButton } from "../../components/common/IconButton";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { StatusToggleGroup } from "../../components/admin/StatusBadge";
import { SearchBar } from "../../components/common/SearchBar";
import { useCms } from "../../state/CmsProvider";
import { createTopic, updateTopic, softDelete } from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import { cx, formatFileSize } from "../../lib/utils";
import type { PublishStatus, Subject, Topic } from "../../types";

interface TopicFormState {
  semesterId: string;
  subjectId: string;
  title: string;
  description: string;
  pageCount: string;
  order: string;
  status: Topic["status"];
}

/** Paper-icon tint for topic rows, keyed by publish status. */
const STATUS_PAPER: Record<PublishStatus, string> = {
  published: "bg-success-muted text-success",
  draft: "bg-warning-muted text-warning",
  hidden: "bg-surface-muted text-muted-foreground",
};

export default function AdminTopics() {
  const db = useCms();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  /** Subject accordion: only one card expanded at a time. */
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  /** When the edit modal was opened via ?edit=<id>&from=detail, closing it
   *  returns to that topic's detail page instead of staying on the list. */
  const [returnToTopic, setReturnToTopic] = useState<string | null>(null);
  const [form, setForm] = useState<TopicFormState>({
    semesterId: "", subjectId: "", title: "", description: "", pageCount: "", order: "1", status: "draft",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof TopicFormState, string>>>({});
  const [pendingDelete, setPendingDelete] = useState<Topic | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState("");
  const [pdfDragActive, setPdfDragActive] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const acceptPdf = (file: File | undefined | null) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setPdfError("Only PDF files are supported.");
      return;
    }
    setPdfError("");
    setPdfFile(file);
  };

  const semesters = useMemo(
    () => db.semesters.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order),
    [db.semesters],
  );
  const semesterById = useMemo(() => new Map(semesters.map((s) => [s.id, s])), [semesters]);
  const allSubjects = useMemo(
    () =>
      db.subjects
        .filter((s) => !s.deletedAt)
        .sort(
          (a, b) =>
            (semesterById.get(a.semesterId)?.order ?? 99) - (semesterById.get(b.semesterId)?.order ?? 99) ||
            a.name.localeCompare(b.name),
        ),
    [db.subjects, semesterById],
  );
  const subjectById = useMemo(() => new Map(allSubjects.map((s) => [s.id, s])), [allSubjects]);
  const subjects = useMemo(
    () => allSubjects.filter((s) => !semesterFilter || s.semesterId === semesterFilter),
    [allSubjects, semesterFilter],
  );
  const liveTopics = useMemo(() => db.topics.filter((t) => !t.deletedAt), [db.topics]);

  const stats = useMemo(
    () => ({
      total: liveTopics.length,
      published: liveTopics.filter((t) => t.status === "published").length,
      draft: liveTopics.filter((t) => t.status === "draft").length,
      hidden: liveTopics.filter((t) => t.status === "hidden").length,
    }),
    [liveTopics],
  );

  /** Subjects with their (optionally search-filtered) topic lists. */
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subjects
      .map((subject) => {
        const all = liveTopics
          .filter((t) => t.subjectId === subject.id)
          .sort((a, b) => a.order - b.order);
        if (!q) return { subject, topics: all };
        const subjectMatches =
          subject.name.toLowerCase().includes(q) || subject.code.toLowerCase().includes(q);
        if (subjectMatches) return { subject, topics: all };
        return {
          subject,
          topics: all.filter(
            (t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q),
          ),
        };
      })
      .filter((g) => !q || g.topics.length > 0);
  }, [subjects, liveTopics, query]);

  const nextOrderFor = (subjectId: string): number => {
    return liveTopics.filter((t) => t.subjectId === subjectId).length + 1;
  };

  /** Open the topic's detail page (info + PDF reader). */
  const openTopicDetail = (t: Topic) => {
    navigate(`/admin/topics/${t.id}`);
  };

  const openCreate = (preset?: Subject) => {
    const subject = preset ?? subjects[0];
    const semester = subject ? semesterById.get(subject.semesterId) : undefined;
    setEditing(null);
    setForm({
      semesterId: semester?.id ?? semesterFilter ?? semesters[0]?.id ?? "",
      subjectId: subject?.id ?? "",
      title: "",
      description: "",
      pageCount: "",
      order: String(subject ? nextOrderFor(subject.id) : 1),
      status: "draft",
    });
    setPdfFile(null);
    setPdfError("");
    setFormOpen(true);
  };

  const openEdit = (t: Topic) => {
    const subject = subjectById.get(t.subjectId);
    /** Pre-fill page count from the topic's linked resource, if any. */
    const linked = db.resources.find((r) => r.topicId === t.id && !r.deletedAt);
    setEditing(t);
    setForm({
      semesterId: subject?.semesterId ?? "",
      subjectId: t.subjectId,
      title: t.title,
      description: t.description ?? "",
      pageCount: linked ? String(linked.pageCount) : "",
      order: String(t.order),
      status: t.status,
    });
    setPdfFile(null);
    setPdfError("");
    setFormOpen(true);
  };

  /** Deep link support: /admin/topics?edit=<id> opens the edit modal
   *  pre-filled. ?from=detail (set by the Topic Detail page) returns to
   *  that topic's detail page after the modal closes. */
  const editParam = searchParams.get("edit");
  const fromParam = searchParams.get("from");
  useEffect(() => {
    if (!editParam || formOpen) return;
    const t = liveTopics.find((x) => x.id === editParam);
    if (t) {
      openEdit(t);
      if (fromParam === "detail") setReturnToTopic(t.id);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParam]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.subjectId) next.subjectId = "Select a subject.";
    if (!form.title.trim()) next.title = "Topic name is required.";
    if (!form.order || Number(form.order) < 1) next.order = "Order must be ≥ 1.";
    if (form.pageCount && Number(form.pageCount) < 1) next.pageCount = "Page count must be ≥ 1.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const draft = {
      subjectId: form.subjectId,
      title: form.title.trim(),
      description: form.description.trim(),
      order: Number(form.order),
      status: form.status,
    };
    if (editing) {
      updateTopic(editing.id, draft);
      toast("Topic updated");
    } else {
      createTopic(draft);
      toast(pdfFile ? `Topic created — PDF "${pdfFile.name}" will be uploaded to Cloudinary later` : "Topic created");
    }
    setFormOpen(false);
    /** Editing was launched from the Topic Detail page — return there so
     *  the admin sees the updated topic in context. */
    if (returnToTopic) {
      navigate(`/admin/topics/${returnToTopic}`, { replace: true });
      setReturnToTopic(null);
    }
  };

  const subjectOptions = form.semesterId
    ? allSubjects.filter((s) => s.semesterId === form.semesterId)
    : allSubjects;

  /** PDF currently linked to the topic being edited (resource.topicId);
   *  shown as the pre-filled "current file" in the upload area. */
  const editingPdf = editing
    ? db.resources.find((r) => r.topicId === editing.id && !r.deletedAt)
    : undefined;

  return (
    <div>
      <PageHeader
        title="Topics"
        subtitle="Syllabus topics inside each subject — shown in the student topic accordion."
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Topics" },
        ]}
        actions={
          <Button onClick={() => openCreate()} disabled={allSubjects.length === 0}>
            <Plus className="size-4" aria-hidden="true" /> Add Topic
          </Button>
        }
      />

      {/* Summary cards — single row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Topics"
          value={stats.total}
          hint={`${stats.published} published · ${stats.draft} drafts`}
          icon={<ListChecks className="size-5" aria-hidden="true" />}
        />
        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Published
            </p>
            <p className="mt-1.5 text-2xl font-bold text-foreground">{stats.published}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground/80">visible to students</p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success-muted text-success">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
        </Card>
        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Drafts
            </p>
            <p className="mt-1.5 text-2xl font-bold text-foreground">{stats.draft}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground/80">not yet published</p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning-muted text-warning">
            <FileEdit className="size-5" aria-hidden="true" />
          </span>
        </Card>
        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Hidden
            </p>
            <p className="mt-1.5 text-2xl font-bold text-foreground">{stats.hidden}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground/80">excluded from student view</p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
            <EyeOff className="size-5" aria-hidden="true" />
          </span>
        </Card>
      </div>

      {/* Toolbar: search + semester filter dropdown */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          placeholder="Search topics or subjects..."
          className="flex-1 sm:max-w-md"
          onSubmit={setQuery}
          onChange={setQuery}
        />
        <Select
          id="topics-semester-filter"
          label=""
          value={semesterFilter}
          onChange={(e) => setSemesterFilter(e.target.value)}
          className="w-full sm:w-48"
          aria-label="Filter by semester"
          options={[
            { value: "", label: "All Semesters" },
            ...semesters.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      </div>

      {/* Subject accordion cards */}
      {grouped.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No topics"
            message={
              allSubjects.length === 0
                ? "Add a subject first."
                : subjects.length === 0
                  ? "No subjects in this semester yet."
                  : "No topics match your search or filters."
            }
            actionLabel={allSubjects.length > 0 ? "Add Topic" : undefined}
            onAction={allSubjects.length > 0 ? () => openCreate() : undefined}
          />
        </div>
      ) : (
        <section aria-labelledby="topics-by-subject" className="mt-6">
          <h2 id="topics-by-subject" className="mb-3.5 text-lg font-semibold text-foreground">
            Topics by Subject
            <span className="ml-2 text-sm font-medium text-muted-foreground">
              ({grouped.length} {grouped.length === 1 ? "subject" : "subjects"})
            </span>
          </h2>
          <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {grouped.map(({ subject, topics }) => {
              const isOpen = expanded === subject.id;
              const semester = semesterById.get(subject.semesterId);
              return (
                <Card
                  key={subject.id}
                  interactive
                  className={cx(
                    "flex flex-col overflow-hidden transition-[box-shadow,border-color] duration-300",
                    isOpen && "border-primary/40 shadow-card-hover",
                  )}
                >
                  {/* Card header — click to expand/collapse */}
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`topics-panel-${subject.id}`}
                    onClick={() => setExpanded(isOpen ? null : subject.id)}
                    className={cx(
                      "group flex flex-1 cursor-pointer items-start justify-between gap-3 p-4 text-left sm:p-5",
                      "transition-colors duration-300 hover:bg-surface-hover",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="primary">{subject.code}</Badge>
                        <Badge tone="neutral">{semester?.name ?? "—"}</Badge>
                      </div>
                      <h3 className="mt-2.5 text-base font-bold text-foreground">{subject.name}</h3>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {topics.length} {topics.length === 1 ? "topic" : "topics"}
                      </p>
                    </div>
                    <span
                      className={cx(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary",
                        "transition-transform duration-300 group-hover:scale-105",
                      )}
                    >
                      <BookMarked className="size-5" aria-hidden="true" />
                    </span>
                  </button>

                  {/* View / Hide Topics — small text, bottom right of the card header */}
                  <div className="flex items-center justify-end border-t border-border/60 bg-surface-muted/40 px-4 py-2.5 sm:px-5">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`topics-panel-${subject.id}`}
                      onClick={() => setExpanded(isOpen ? null : subject.id)}
                      className={cx(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-lg text-xs font-bold",
                        "text-muted-foreground transition-colors duration-300 hover:text-primary",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        isOpen && "text-primary",
                      )}
                    >
                      {isOpen ? "Hide Topics" : "View Topics"}
                      <ChevronDown
                        className={cx("size-3.5 transition-transform duration-300", isOpen && "rotate-180")}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  {/* Expanded topics panel — smooth grid-rows height animation */}
                  <div
                    id={`topics-panel-${subject.id}`}
                    className={cx(
                      "grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.2,0,0,1)]",
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-border bg-surface-muted/60 p-3 sm:p-4">
                        {topics.length > 0 ? (
                          <ul className="space-y-2">
                            {topics.map((t) => (
                              <li
                                key={t.id}
                                className={cx(
                                  "flex items-center gap-2.5 rounded-lg border border-border bg-surface p-2.5",
                                  "transition-colors duration-200 hover:border-primary/30 hover:bg-surface-hover",
                                )}
                              >
                                <span
                                  className={cx(
                                    "flex size-7 shrink-0 items-center justify-center rounded-md",
                                    STATUS_PAPER[t.status],
                                  )}
                                  aria-hidden="true"
                                >
                                  <FileText className="size-3.5" aria-hidden="true" />
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openTopicDetail(t)}
                                  title={t.title}
                                  className={cx(
                                    "min-w-0 flex-1 truncate rounded-lg py-0.5 text-left text-sm font-medium",
                                    "text-foreground transition-colors duration-200 hover:text-primary",
                                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                                  )}
                                >
                                  {t.title}
                                </button>
                                <div className="ml-auto flex shrink-0 items-center gap-1">
                                  <IconButton
                                    icon={Pencil}
                                    label={`Edit ${t.title}`}
                                    size="sm"
                                    onClick={() => openEdit(t)}
                                  />
                                  <IconButton
                                    icon={Trash2}
                                    label={`Delete ${t.title}`}
                                    size="sm"
                                    variant="danger"
                                    onClick={() => setPendingDelete(t)}
                                  />
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="rounded-lg border border-dashed border-border-strong px-3 py-2.5 text-xs text-muted-foreground">
                            No topics yet — add the first topic for this subject.
                          </p>
                        )}
                        <div className="mt-3 flex justify-center sm:justify-end">
                          <Button variant="outline" size="sm" onClick={() => openCreate(subject)}>
                            <Plus className="size-4" aria-hidden="true" /> Add topic to this subject
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Add / Edit modal — wide two-column layout: form left, PDF upload right */}
      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          if (returnToTopic) {
            navigate(`/admin/topics/${returnToTopic}`, { replace: true });
            setReturnToTopic(null);
          }
        }}
        title={editing ? "Edit Topic" : "Add Topic"}
        className="max-w-3xl lg:max-w-none lg:w-[68rem]"
      >
        <form onSubmit={handleSubmit} noValidate className="mt-4 text-left">
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:gap-8">
            {/* LEFT — Topic Information */}
            <fieldset className="min-w-0 space-y-4">
              <legend className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Topic Information
              </legend>
              <Input
                id="topic-title"
                label="Topic Name"
                placeholder="e.g. Normalization"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                error={errors.title}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  id="topic-semester"
                  label="Semester"
                  value={form.semesterId}
                  disabled={Boolean(editing)}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, semesterId: e.target.value, subjectId: "", order: "1" }))
                  }
                  options={[
                    { value: "", label: "Select semester..." },
                    ...semesters.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
                <Select
                  id="topic-subject"
                  label="Subject"
                  value={form.subjectId}
                  error={errors.subjectId}
                  disabled={Boolean(editing)}
                  onChange={(e) => {
                    const id = e.target.value;
                    const subject = subjectById.get(id);
                    setForm((p) => ({
                      ...p,
                      subjectId: id,
                      semesterId: subject?.semesterId ?? p.semesterId,
                      order: String(subject ? nextOrderFor(id) : 1),
                    }));
                  }}
                  options={[
                    { value: "", label: "Select subject..." },
                    ...subjectOptions.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` })),
                  ]}
                />
              </div>
              <Textarea
                id="topic-description"
                label="Description / Discussion (optional)"
                rows={4}
                placeholder="Short description shown in the accordion..."
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id="topic-page-count"
                  label="Page Count (optional)"
                  type="number"
                  min={1}
                  value={form.pageCount}
                  onChange={(e) => setForm((p) => ({ ...p, pageCount: e.target.value }))}
                  error={errors.pageCount}
                />
                <Input
                  id="topic-order"
                  label="Order"
                  type="number"
                  min={1}
                  value={form.order}
                  onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
                  error={errors.order}
                />
              </div>
              <div className="space-y-1.5">
                <span className="block text-sm font-semibold text-foreground">Status</span>
                <div className="flex h-10 items-center">
                  <StatusToggleGroup
                    value={form.status}
                    onChange={(next) => setForm((p) => ({ ...p, status: next }))}
                    size="md"
                  />
                </div>
              </div>
            </fieldset>

            {/* RIGHT — PDF Upload */}
            <fieldset className="min-w-0 rounded-xl border border-border-strong bg-surface-muted/60 p-4 lg:flex lg:flex-col">
              <legend className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                PDF Upload
              </legend>
              <div className="mt-2 flex items-center gap-2 lg:mt-0">
                <FileUp className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-sm font-bold text-foreground">Resource File</span>
                <span className="text-xs font-medium text-muted-foreground">(optional)</span>
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setPdfDragActive(true);
                }}
                onDragLeave={() => setPdfDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setPdfDragActive(false);
                  acceptPdf(e.dataTransfer.files?.[0]);
                }}
                className={cx(
                  "mt-3 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center",
                  "transition-colors lg:flex-1 lg:py-10 py-8",
                  pdfDragActive
                    ? "border-primary bg-primary-muted"
                    : pdfFile
                      ? "border-success bg-success-muted/40"
                      : "border-border-strong bg-surface hover:border-primary/50",
                )}
              >
                {pdfFile ? (
                  <>
                    <span className="flex size-12 items-center justify-center rounded-xl bg-error-muted text-error">
                      <FileText className="size-6" aria-hidden="true" />
                    </span>
                    <p className="mt-3 flex max-w-full items-center gap-1.5 text-sm font-bold text-foreground">
                      <span className="truncate">{pdfFile.name}</span>
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                      {formatFileSize(pdfFile.size)} · PDF ready
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => pdfInputRef.current?.click()}
                      >
                        <RotateCcw className="size-4" aria-hidden="true" /> Replace
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        className="text-error hover:bg-error-muted hover:text-error"
                        onClick={() => setPdfFile(null)}
                      >
                        <X className="size-4" aria-hidden="true" /> Remove
                      </Button>
                    </div>
                  </>
                ) : editing && editingPdf ? (
                  <>
                    <span className="flex size-12 items-center justify-center rounded-xl bg-success-muted text-success">
                      <FileText className="size-6" aria-hidden="true" />
                    </span>
                    <p className="mt-3 flex max-w-full items-center gap-1.5 text-sm font-bold text-foreground">
                      <span className="truncate">{editingPdf.title}</span>
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                      {editingPdf.pageCount} pages · {formatFileSize(editingPdf.fileSize)} · current file
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      className="mt-3"
                      onClick={() => pdfInputRef.current?.click()}
                    >
                      <FolderOpen className="size-4" aria-hidden="true" /> Replace File
                    </Button>
                  </>
                ) : (
                  <>
                    <CloudUpload className="size-9 text-muted-foreground/70" aria-hidden="true" />
                    <p className="mt-2.5 text-sm font-bold text-foreground">Drag & drop your PDF here</p>
                    <p className="text-xs text-muted-foreground">or</p>
 <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      className="mt-1.5"
                      onClick={() => pdfInputRef.current?.click()}
                    >
                      <FolderOpen className="size-4" aria-hidden="true" /> Choose PDF
                    </Button>
                  </>
                )}
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    acceptPdf(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                  aria-label="Choose PDF file"
                />
              </div>
              {pdfError && (
                <p role="alert" className="mt-2 text-xs font-medium text-error">
                  {pdfError}
                </p>
              )}
              <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                PDFs will be stored using Cloudinary later — for now the file is kept locally in this form.
              </p>
            </fieldset>
          </div>

          {/* BOTTOM — Actions */}
          <div className="mt-5 flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button variant="ghost" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              type="submit"
              onClick={() => setForm((p) => ({ ...p, status: "draft" }))}
            >
              <FileEdit className="size-4" aria-hidden="true" /> Save as Draft
            </Button>
            <Button type="submit" onClick={() => setForm((p) => ({ ...p, status: "published" }))}>
              <Send className="size-4" aria-hidden="true" /> Save & Publish
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete topic"
        message={`"${pendingDelete?.title}" will move to the trash. Its resources will fall back to subject-wide resources.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            softDelete("topic", pendingDelete.id);
            toast("Topic moved to trash");
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
