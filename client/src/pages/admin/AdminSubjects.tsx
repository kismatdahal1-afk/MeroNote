import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { PageHeader, Card } from "../../components/common/PageHeader";
import { Input, Select, Textarea } from "../../components/common/Field";
import { Button } from "../../components/common/Button";
import { IconButton } from "../../components/common/IconButton";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { StatusToggleGroup } from "../../components/admin/StatusBadge";
import { SearchBar } from "../../components/common/SearchBar";
import { useCms } from "../../state/CmsProvider";
import { createSubject, updateSubject, setSubjectStatus, softDelete } from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import type { Subject } from "../../types";

interface SubjectFormState {
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

export default function AdminSubjects() {
  const db = useCms();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState<SubjectFormState>({
    semesterId: "", name: "", code: "", description: "",
    category: "core", credits: "3", fullMarks: "60", hotTopics: "", status: "published",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SubjectFormState, string>>>({});
  const [pendingDelete, setPendingDelete] = useState<Subject | null>(null);

  const semesters = useMemo(
    () => db.semesters.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order),
    [db.semesters],
  );

  const subjects = useMemo(() => {
    let list = db.subjects.filter((s) => !s.deletedAt);
    if (semesterFilter) list = list.filter((s) => s.semesterId === semesterFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [db.subjects, query, semesterFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      semesterId: semesterFilter || semesters[0]?.id || "",
      name: "", code: "", description: "",
      category: "core", credits: "3", fullMarks: "60", hotTopics: "", status: "published",
    });
    setFormOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
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
    <div>
      <PageHeader
        title="Subjects"
        subtitle="Manage course metadata — code, credits, full marks."
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Subjects" },
        ]}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" /> Add Subject
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          placeholder="Search subjects..."
          className="max-w-md flex-1"
          onSubmit={setQuery}
          onChange={setQuery}
        />
        <Select
          id="subjects-semester-filter"
          label=""
          value={semesterFilter}
          onChange={(e) => setSemesterFilter(e.target.value)}
          className="w-full sm:w-52"
          aria-label="Filter by semester"
          options={[
            { value: "", label: "All semesters" },
            ...semesters.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          title="No subjects"
          message="No subjects match your search or filters."
          actionLabel="Add Subject"
          onAction={openCreate}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground/70">
                  <th scope="col" className="px-4 py-3 font-medium">Subject</th>
                  <th scope="col" className="px-4 py-3 font-medium">Semester</th>
                  <th scope="col" className="px-4 py-3 font-medium">Credits</th>
                  <th scope="col" className="px-4 py-3 font-medium">Full Marks</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subjects.map((s) => {
                  const semester = db.semesters.find((x) => x.id === s.semesterId);
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-surface-hover">
                      <td className="max-w-xs px-4 py-3">
                        <p className="line-clamp-1 font-medium text-foreground">{s.name}</p>
                        <p className="mt-0.5 text-xs font-mono text-muted-foreground">{s.code}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{semester?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.credits}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.fullMarks ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusToggleGroup value={s.status} onChange={(next) => setSubjectStatus(s.id, next)} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton icon={Pencil} label={`Edit ${s.name}`} size="sm" onClick={() => openEdit(s)} />
                          <IconButton
                            icon={Trash2}
                            label={`Delete ${s.name}`}
                            size="sm"
                            variant="danger"
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
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit Subject" : "Add Subject"}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} noValidate className="mt-2 space-y-4">
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
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="sub-name"
              label="Subject name"
              placeholder="e.g. Database Management System"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              error={errors.name}
            />
            <Input
              id="sub-code"
              label="Course code"
              placeholder="e.g. CSC402"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              error={errors.code}
            />
          </div>
          <Textarea
            id="sub-description"
            label="Description"
            rows={3}
            placeholder="Short description shown on the subject page..."
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              id="sub-credits"
              label="Credit hours"
              type="number"
              min={1}
              value={form.credits}
              onChange={(e) => setForm((p) => ({ ...p, credits: e.target.value }))}
              error={errors.credits}
            />
            <Input
              id="sub-marks"
              label="Full marks (optional)"
              type="number"
              min={1}
              placeholder="e.g. 60"
              value={form.fullMarks}
              onChange={(e) => setForm((p) => ({ ...p, fullMarks: e.target.value }))}
            />
            <Select
              id="sub-status"
              label="Status"
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Subject["status"] }))}
              options={[
                { value: "published", label: "Published" },
                { value: "draft", label: "Draft" },
                { value: "hidden", label: "Hidden" },
              ]}
            />
          </div>
          <Input
            id="sub-hot-topics"
            label="Hot topics (optional)"
            placeholder="comma-separated, e.g. Deadlocks, Page replacement"
            value={form.hotTopics}
            onChange={(e) => setForm((p) => ({ ...p, hotTopics: e.target.value }))}
            hint="Frequently repeated board-exam topics."
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Save changes" : "Create subject"}</Button>
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
