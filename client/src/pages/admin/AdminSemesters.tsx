import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { PageHeader, Card } from "../../components/common/PageHeader";
import { Input, Select, Textarea } from "../../components/common/Field";
import { Button } from "../../components/common/Button";
import { IconButton } from "../../components/common/IconButton";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { StatusToggleGroup } from "../../components/admin/StatusBadge";
import { useCms } from "../../state/CmsProvider";
import {
  createSemester, updateSemester, setSemesterStatus,
  reorderSemesters, softDelete,
} from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import type { Semester } from "../../types";

interface SemesterFormState {
  name: string;
  description: string;
  order: string;
  status: Semester["status"];
}

export default function AdminSemesters() {
  const db = useCms();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Semester | null>(null);
  const [form, setForm] = useState<SemesterFormState>({ name: "", description: "", order: "", status: "published" });
  const [errors, setErrors] = useState<Partial<Record<keyof SemesterFormState, string>>>({});
  const [pendingDelete, setPendingDelete] = useState<Semester | null>(null);

  const semesters = useMemo(
    () => db.semesters.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order),
    [db.semesters],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: `Semester ${semesters.length + 1}`,
      description: "",
      order: String(semesters.length + 1),
      status: "published",
    });
    setFormOpen(true);
  };

  const openEdit = (s: Semester) => {
    setEditing(s);
    setForm({ name: s.name, description: s.description, order: String(s.order), status: s.status });
    setFormOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!form.order || Number(form.order) < 1) next.order = "Order must be ≥ 1.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const draft = {
      name: form.name.trim(),
      description: form.description.trim(),
      order: Number(form.order),
      status: form.status,
    };
    if (editing) {
      updateSemester(editing.id, draft);
      toast("Semester updated");
    } else {
      createSemester(draft);
      toast("Semester created");
    }
    setFormOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Semesters"
        subtitle="Create, reorder, enable, or disable semesters."
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Semesters" },
        ]}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" /> Add Semester
          </Button>
        }
      />

      {semesters.length === 0 ? (
        <EmptyState
          title="No semesters"
          message="Create your first semester to start building the curriculum."
          actionLabel="Add Semester"
          onAction={openCreate}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground/70">
                  <th scope="col" className="px-4 py-3 font-medium">Order</th>
                  <th scope="col" className="px-4 py-3 font-medium">Semester</th>
                  <th scope="col" className="px-4 py-3 font-medium">Subjects</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {semesters.map((s, i) => {
                  const subjectCount = db.subjects.filter((x) => !x.deletedAt && x.semesterId === s.id).length;
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-surface-hover">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="w-6 text-xs font-bold text-muted-foreground">{s.order}</span>
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
                      <td className="max-w-xs px-4 py-3">
                        <p className="line-clamp-1 font-medium text-foreground">{s.name}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">{s.description}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{subjectCount}</td>
                      <td className="px-4 py-3">
                        <StatusToggleGroup
                          value={s.status}
                          onChange={(next) => setSemesterStatus(s.id, next)}
                        />
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
        title={editing ? "Edit Semester" : "Add Semester"}
      >
        <form onSubmit={handleSubmit} noValidate className="mt-2 space-y-4">
          <Input
            id="sem-name"
            label="Name"
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
            <Select
              id="sem-status"
              label="Status"
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Semester["status"] }))}
              options={[
                { value: "published", label: "Published" },
                { value: "draft", label: "Draft" },
                { value: "hidden", label: "Hidden" },
              ]}
            />
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
