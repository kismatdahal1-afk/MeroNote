import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown, ArrowUp, BookOpen, CheckCircle2, ChevronRight, EyeOff,
  FileEdit, GraduationCap, Pencil, Plus, Trash2, type LucideIcon,
} from "lucide-react";
import { Card } from "../../components/common/PageHeader";
import { Input, Textarea } from "../../components/common/Field";
import { Button } from "../../components/common/Button";
import { IconButton } from "../../components/common/IconButton";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { Badge } from "../../components/common/Badge";
import { StatusBadge, StatusToggleGroup } from "../../components/admin/StatusBadge";
import { useCms } from "../../state/CmsProvider";
import {
  createSemester, createSubject, branchSemesterToDraft, reorderSemesters,
  setSemesterStatus, softDelete, updateSemester,
} from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import { cx } from "../../lib/utils";
import type { Semester } from "../../types";

const STATUS_CYCLE: Record<Semester["status"], Semester["status"]> = {
  published: "draft",
  draft: "hidden",
  hidden: "published",
};

interface SemesterFormState {
  name: string;
  description: string;
  order: string;
  status: Semester["status"];
  subjects: string;
}

function subjectCode(name: string): string {
  const code = name.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 4);
  return code || "SUB";
}

function addSubjectsFor(semesterId: string, names: string[], status: Semester["status"]): number {
  let created = 0;
  for (const name of names) {
    createSubject({
      semesterId,
      name,
      code: subjectCode(name),
      description: "",
      category: "core",
      credits: 3,
      status,
    });
    created += 1;
  }
  return created;
}

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

export default function AdminSemesters() {
  const db = useCms();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Semester | null>(null);
  const [form, setForm] = useState<SemesterFormState>({
    name: "", description: "", order: "", status: "published", subjects: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SemesterFormState, string>>>({});
  const [pendingDelete, setPendingDelete] = useState<Semester | null>(null);

  const semesters = useMemo(
    () => db.semesters.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order),
    [db.semesters],
  );

  const stats = useMemo(() => ({
    total: semesters.length,
    published: semesters.filter((s) => s.status === "published").length,
    draft: semesters.filter((s) => s.status === "draft").length,
    hidden: semesters.filter((s) => s.status === "hidden").length,
  }), [semesters]);

  const subjectsOf = (semesterId: string) =>
    db.subjects.filter((x) => !x.deletedAt && x.semesterId === semesterId);

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setForm({
      name: `Semester ${semesters.length + 1}`,
      description: "",
      order: String(semesters.length + 1),
      status: "published",
      subjects: "",
    });
    setFormOpen(true);
  };

  const openEdit = (s: Semester) => {
    setEditing(s);
    setErrors({});
    setForm({ name: s.name, description: s.description, order: String(s.order), status: s.status, subjects: "" });
    setFormOpen(true);
  };

  const cycleStatus = (s: Semester) => {
    const next = STATUS_CYCLE[s.status];
    setSemesterStatus(s.id, next);
    toast(`${s.name} is now ${next}`, "info");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const orderNum = Number(form.order);
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Semester name is required.";
    if (!form.order || !Number.isInteger(orderNum) || orderNum < 1) {
      next.order = "Order must be a whole number of at least 1.";
    } else if (semesters.some((s) => s.order === orderNum && s.id !== editing?.id)) {
      next.order = "This order is already used by another semester.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const existingNames = new Set(
      editing ? subjectsOf(editing.id).map((x) => x.name.toLowerCase()) : [],
    );
    const subjectNames = [...new Set(
      form.subjects
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x.length > 0 && !existingNames.has(x.toLowerCase())),
    )];

    const draft = {
      name: form.name.trim(),
      description: form.description.trim(),
      order: orderNum,
      status: form.status,
    };

    if (editing) {
      // Editing a published/hidden semester + switching to Draft → keep the
      // live version untouched and stage the edits as a new draft in Drafts.
      if (form.status === "draft" && editing.status !== "draft") {
        branchSemesterToDraft(editing.id, draft);
        toast("Edits saved as a new draft — the published semester is unchanged");
      } else {
        updateSemester(editing.id, draft);
        const added = addSubjectsFor(editing.id, subjectNames, form.status);
        toast(added > 0 ? `Semester updated — ${added} subject${added > 1 ? "s" : ""} added` : "Semester updated");
      }
    } else {
      const created = createSemester(draft);
      addSubjectsFor(created.id, subjectNames, form.status);
      toast("Semester created");
    }
    setFormOpen(false);
  };

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Link to="/admin" className="rounded px-1 py-0.5 hover:text-primary">Admin</Link>
        <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
        <span aria-current="page" className="font-semibold text-foreground">Semesters</span>
      </nav>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
            <GraduationCap className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-foreground">Semesters</h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Organize the curriculum — add, reorder, and control semester visibility.
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="size-4" aria-hidden="true" /> Add Semester
        </Button>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total Semesters" value={stats.total} icon={GraduationCap} iconClass="bg-primary-muted text-primary" />
        <StatTile label="Published" value={stats.published} icon={CheckCircle2} iconClass="bg-success-muted text-success" />
        <StatTile label="Draft" value={stats.draft} icon={FileEdit} iconClass="bg-warning-muted text-warning" />
        <StatTile label="Hidden" value={stats.hidden} icon={EyeOff} iconClass="bg-surface-muted text-muted-foreground" />
      </div>

      {semesters.length === 0 ? (
        <EmptyState
          title="No semesters"
          message="Create your first semester to start building the curriculum."
          actionLabel="Add Semester"
          onAction={openCreate}
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-[11px] uppercase tracking-wider text-muted-foreground/80">
                    <th scope="col" className="px-4 py-3 font-semibold">Order</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Semester</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Subjects</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {semesters.map((s, i) => {
                    const subjectCount = subjectsOf(s.id).length;
                    return (
                      <tr key={s.id} className="transition-colors hover:bg-surface-hover">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted text-xs font-bold tabular-nums text-muted-foreground">
                              {s.order}
                            </span>
                            <IconButton
                              icon={ArrowUp}
                              label={`Move ${s.name} up`}
                              size="sm"
                              disabled={i === 0}
                              onClick={() => reorderSemesters(s.id, -1)}
                            />
                            <IconButton
                              icon={ArrowDown}
                              label={`Move ${s.name} down`}
                              size="sm"
                              disabled={i === semesters.length - 1}
                              onClick={() => reorderSemesters(s.id, 1)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary">
                              <GraduationCap className="size-4" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 max-w-[280px]">
                              <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/80">
                                {s.description || "No description"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            <BookOpen className="size-3.5" aria-hidden="true" />
                            {subjectCount}
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
          </Card>

          <div className="space-y-3 md:hidden">
            {semesters.map((s, i) => {
              const subjectCount = subjectsOf(s.id).length;
              return (
                <Card key={s.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary">
                        <GraduationCap className="size-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{s.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {s.description || "No description"}
                        </p>
                      </div>
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
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      <BookOpen className="size-3.5" aria-hidden="true" />
                      {subjectCount} subject{subjectCount === 1 ? "" : "s"}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      Order {s.order}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                    <div className="flex items-center gap-1">
                      <IconButton
                        icon={ArrowUp}
                        label={`Move ${s.name} up`}
                        size="sm"
                        disabled={i === 0}
                        onClick={() => reorderSemesters(s.id, -1)}
                      />
                      <IconButton
                        icon={ArrowDown}
                        label={`Move ${s.name} down`}
                        size="sm"
                        disabled={i === semesters.length - 1}
                        onClick={() => reorderSemesters(s.id, 1)}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
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
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit Semester" : "Add Semester"}
      >
        <form onSubmit={handleSubmit} noValidate className="mt-2 space-y-4">
          <Input
            id="sem-name"
            label="Semester"
            placeholder="e.g. Semester 5"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            error={errors.name}
          />
          <Textarea
            id="sem-description"
            label="Description"
            rows={3}
            placeholder="What this semester covers..."
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          {editing && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">Current subjects</p>
              {subjectsOf(editing.id).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {subjectsOf(editing.id).map((sub) => (
                    <Badge key={sub.id} tone="neutral">{sub.name}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No subjects yet — add some below.</p>
              )}
            </div>
          )}
          <Input
            id="sem-subjects"
            label="Subjects / Courses"
            placeholder="e.g. Data Structures, DBMS, Operating Systems"
            hint={editing
              ? "Comma-separated — new subjects are added to this semester."
              : "Comma-separated — created with this semester."}
            value={form.subjects}
            onChange={(e) => setForm((p) => ({ ...p, subjects: e.target.value }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="sem-order"
              label="Order"
              type="number"
              min={1}
              value={form.order}
              onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
              error={errors.order}
            />
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
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Save changes" : "Create semester"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete semester"
        message={`"${pendingDelete?.name}" and its subjects, topics, and resources will move to the trash. Students will no longer see them.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            softDelete("semester", pendingDelete.id);
            toast("Semester moved to trash");
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
