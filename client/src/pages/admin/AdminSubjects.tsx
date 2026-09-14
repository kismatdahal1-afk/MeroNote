import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen, CheckCircle2, ChevronRight, FileEdit, GraduationCap,
  Pencil, Plus, Trash2, type LucideIcon,
} from "lucide-react";
import { Card } from "../../components/common/PageHeader";
import { Input, Select, Textarea } from "../../components/common/Field";
import { Button } from "../../components/common/Button";
import { IconButton } from "../../components/common/IconButton";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { Badge } from "../../components/common/Badge";
import { StatusBadge, StatusToggleGroup } from "../../components/admin/StatusBadge";
import { SearchBar } from "../../components/common/SearchBar";
import { useCms } from "../../state/CmsProvider";
import { createSubject, setSubjectStatus, softDelete, updateSubject } from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import { cx } from "../../lib/utils";
import type { PublishStatus, Subject } from "../../types";

const STATUS_CYCLE: Record<PublishStatus, PublishStatus> = {
  published: "draft",
  draft: "hidden",
  hidden: "published",
};interface SubjectFormState {
  semesterId: string;
  name: string;
  code: string;
  description: string;
  category: Subject["category"];
  credits: string;
  fullMarks: string;
  hotTopics: string;
  status: Subject["status"];
}

const EMPTY_FORM: SubjectFormState = {
  semesterId: "", name: "", code: "", description: "",
  category: "core", credits: "3", fullMarks: "60", hotTopics: "", status: "published",
};

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

function SemesterChip({ active, label, count, onClick }: {
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

export default function AdminSubjects() {
  const db = useCms();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState<SubjectFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof SubjectFormState, string>>>({});
  const [pendingDelete, setPendingDelete] = useState<Subject | null>(null);

  const semesters = useMemo(
    () => db.semesters.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order),
    [db.semesters],
  );

  const allSubjects = useMemo(
    () => db.subjects.filter((s) => !s.deletedAt),
    [db.subjects],
  );

  const stats = useMemo(() => ({
    total: allSubjects.length,
    published: allSubjects.filter((s) => s.status === "published").length,
    draft: allSubjects.filter((s) => s.status === "draft").length,
    semestersCovered: new Set(allSubjects.map((s) => s.semesterId)).size,
  }), [allSubjects]);

  const semesterById = useMemo(
    () => new Map(db.semesters.map((s) => [s.id, s])),
    [db.semesters],
  );

  const countFor = (semesterId: string) =>
    allSubjects.filter((s) => s.semesterId === semesterId).length;

  const subjects = useMemo(() => {
    let list = allSubjects;
    if (semesterFilter) list = list.filter((s) => s.semesterId === semesterFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [allSubjects, query, semesterFilter]);

  const groups = useMemo(() => {
    const result = semesters
      .map((sem) => ({
        id: sem.id,
        name: sem.name,
        list: subjects.filter((s) => s.semesterId === sem.id),
      }))
      .filter((g) => g.list.length > 0);
    const orphans = subjects.filter((s) => !semesterById.has(s.semesterId));
    if (orphans.length > 0) {
      result.push({ id: "ungrouped", name: "Ungrouped", list: orphans });
    }
    return result;
  }, [semesters, subjects, semesterById]);

  const topicCountOf = (subjectId: string) =>
    db.topics.filter((t) => !t.deletedAt && t.subjectId === subjectId).length;

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setForm({ ...EMPTY_FORM, semesterId: semesterFilter || semesters[0]?.id || "" });
    setFormOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
    setErrors({});
    setForm({
      semesterId: s.semesterId,
      name: s.name,
      code: s.code,
      description: s.description,
      category: s.category,
      credits: String(s.credits),
      fullMarks: s.fullMarks ? String(s.fullMarks) : "",
      hotTopics: s.hotTopics.join(", "),
      status: s.status,
    });
    setFormOpen(true);
  };

  const cycleStatus = (s: Subject) => {
    const next = STATUS_CYCLE[s.status];
    setSubjectStatus(s.id, next);
    toast(`${s.name} is now ${next}`, "info");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.semesterId) next.semesterId = "Select a semester.";
    if (!form.name.trim()) next.name = "Subject name is required.";
    if (!form.code.trim()) next.code = "Course code is required.";
    if (!form.credits || Number(form.credits) < 1) next.credits = "Credit hours must be ≥ 1.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const draft = {
      semesterId: form.semesterId,
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      category: form.category,
      credits: Number(form.credits),
      fullMarks: form.fullMarks ? Number(form.fullMarks) : undefined,
      hotTopics: form.hotTopics.split(",").map((t) => t.trim()).filter(Boolean),
      status: form.status,
    };
    if (editing) {
      updateSubject(editing.id, draft);
      toast("Subject updated");
    } else {
      createSubject(draft);
      toast("Subject created");
    }
    setFormOpen(false);
  };

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Link to="/admin" className="rounded px-1 py-0.5 hover:text-primary">Admin</Link>
        <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
        <span aria-current="page" className="font-semibold text-foreground">Subjects</span>
      </nav>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
            <BookOpen className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-foreground">Subjects</h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Manage course metadata — codes, credits, and visibility across semesters.
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="size-4" aria-hidden="true" /> Add Subject
        </Button>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total Subjects" value={stats.total} icon={BookOpen} iconClass="bg-primary-muted text-primary" />
        <StatTile label="Published" value={stats.published} icon={CheckCircle2} iconClass="bg-success-muted text-success" />
        <StatTile label="Drafts" value={stats.draft} icon={FileEdit} iconClass="bg-warning-muted text-warning" />
        <StatTile label="Semesters Covered" value={stats.semestersCovered} icon={GraduationCap} iconClass="bg-accent/15 text-accent" />
      </div>

      <Card className="space-y-3 p-4">
        <SearchBar
          placeholder="Search subjects by name or code..."
          className="w-full sm:max-w-md"
          onSubmit={setQuery}
          onChange={setQuery}
        />
        <div
          role="group"
          aria-label="Filter by semester"
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <SemesterChip
            active={semesterFilter === ""}
            label="All Semesters"
            count={allSubjects.length}
            onClick={() => setSemesterFilter("")}
          />
          {semesters.map((sem) => (
            <SemesterChip
              key={sem.id}
              active={semesterFilter === sem.id}
              label={sem.name}
              count={countFor(sem.id)}
              onClick={() => setSemesterFilter(sem.id)}
            />
          ))}
        </div>
      </Card>

      {allSubjects.length === 0 ? (
        <EmptyState
          title="No subjects"
          message="Create your first subject to start building the curriculum."
          actionLabel="Add Subject"
          onAction={openCreate}
        />
      ) : subjects.length === 0 ? (
        <EmptyState
          title="No matches"
          message="No subjects match your search or semester filter."
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.id} className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border bg-surface-muted px-4 py-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary">
                  <GraduationCap className="size-4" aria-hidden="true" />
                </div>
                <h2 className="truncate text-sm font-bold text-foreground">{group.name}</h2>
                <Badge tone="neutral">{group.list.length} subject{group.list.length === 1 ? "" : "s"}</Badge>
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted text-[11px] uppercase tracking-wider text-muted-foreground/80">
                      <th scope="col" className="px-4 py-2.5 font-semibold">Course Code</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Subject Name</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Credits</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Topics</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {group.list.map((s) => {
                      const topics = topicCountOf(s.id);
                      return (
                        <tr key={s.id} className="transition-colors hover:bg-surface-hover">
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center rounded-lg border border-border bg-surface-muted px-2 py-1 font-mono text-xs font-semibold text-primary">
                              {s.code}
                            </span>
                          </td>
                          <td className="max-w-[280px] px-4 py-3.5">
                            <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/80">
                              {s.description || "No description"}
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-xs font-semibold text-muted-foreground">
                              {s.credits} cr
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                              {topics}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              type="button"
                              onClick={() => cycleStatus(s)}
                              title={`Change status — currently ${s.status}`}
                              className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              <StatusBadge status={s.status} />
                            </button>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <IconButton
                                icon={Pencil}
                                label={`Edit ${s.name}`}
                                size="sm"
                                className="border border-border bg-surface"
                                onClick={() => openEdit(s)}
                              />
                              <IconButton
                                icon={Trash2}
                                label={`Delete ${s.name}`}
                                size="sm"
                                variant="danger"
                                className="border border-border bg-surface"
                                onClick={() => setPendingDelete(s)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-border md:hidden">
                {group.list.map((s) => {
                  const topics = topicCountOf(s.id);
                  const sem = semesterById.get(s.semesterId);
                  return (
                    <div key={s.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-lg border border-border bg-surface-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                              {s.code}
                            </span>
                            {sem && <Badge tone="neutral">{sem.name}</Badge>}
                          </div>
                          <p className="mt-2 truncate text-sm font-bold text-foreground">{s.name}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {s.description || "No description"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => cycleStatus(s)}
                          title={`Change status — currently ${s.status}`}
                          className="shrink-0 rounded-full transition-opacity hover:opacity-80"
                        >
                          <StatusBadge status={s.status} />
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                          {s.credits} credits
                        </span>
                        <span className="inline-flex items-center rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                          {topics} topics
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-border pt-3">
                        <IconButton
                          icon={Pencil}
                          label={`Edit ${s.name}`}
                          size="sm"
                          className="border border-border bg-surface"
                          onClick={() => openEdit(s)}
                        />
                        <IconButton
                          icon={Trash2}
                          label={`Delete ${s.name}`}
                          size="sm"
                          variant="danger"
                          className="border border-border bg-surface"
                          onClick={() => setPendingDelete(s)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit Subject" : "Add Subject"}
        className="max-w-3xl lg:max-w-none lg:w-[64rem] lg:landscape-form"
      >
        <form onSubmit={handleSubmit} noValidate className="mt-2 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="sub-code"
              label="Course Code"
              placeholder="e.g. CSC402"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              error={errors.code}
            />
            <Input
              id="sub-name"
              label="Subject Name"
              placeholder="e.g. Database Management System"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              error={errors.name}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              id="sub-semester"
              label="Semester"
              value={form.semesterId}
              error={errors.semesterId}
              onChange={(e) => setForm((p) => ({ ...p, semesterId: e.target.value }))}
              options={[
                { value: "", label: "Select semester..." },
                ...semesters.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <Input
              id="sub-credits"
              label="Credits"
              type="number"
              min={1}
              value={form.credits}
              onChange={(e) => setForm((p) => ({ ...p, credits: e.target.value }))}
              error={errors.credits}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              id="sub-category"
              label="Category"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as Subject["category"] }))}
              options={[
                { value: "core", label: "Core" },
                { value: "elective", label: "Elective" },
                { value: "practical", label: "Practical" },
              ]}
            />
            <Input
              id="sub-marks"
              label="Full Marks (optional)"
              type="number"
              min={1}
              placeholder="e.g. 60"
              value={form.fullMarks}
              onChange={(e) => setForm((p) => ({ ...p, fullMarks: e.target.value }))}
            />
          </div>
          <div className="landscape-col-span-2">
            <Textarea
              id="sub-description"
              label="Description"
              rows={3}
              placeholder="Short description shown on the subject page..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
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
            <Input
              id="sub-hot-topics"
              label="Hot Topics (optional)"
              placeholder="comma-separated, e.g. Deadlocks, Page replacement"
              value={form.hotTopics}
              onChange={(e) => setForm((p) => ({ ...p, hotTopics: e.target.value }))}
              hint="Frequently repeated board-exam topics."
            />
          </div>
          <div className="flex flex-col-reverse gap-3 lg:flex-row lg:justify-end">
            <Button
              variant="outline"
              type="button"
              className="w-full lg:w-auto"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="w-full lg:w-auto">
              {editing ? "Save changes" : "Create subject"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete subject"
        message={`"${pendingDelete?.name}" and its topics and resources will move to the trash. Students will no longer see them.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            softDelete("subject", pendingDelete.id);
            toast("Subject moved to trash");
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
