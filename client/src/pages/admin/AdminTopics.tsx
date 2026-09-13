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
import { SearchBar } from "../../components/common/SearchBar";
import { useCms } from "../../state/CmsProvider";
import { createTopic, updateTopic, reorderTopics, softDelete } from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import type { Subject, Topic } from "../../types";

interface TopicFormState {
  subjectId: string;
  title: string;
  description: string;
  order: string;
  status: Topic["status"];
}

export default function AdminTopics() {
  const db = useCms();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [form, setForm] = useState<TopicFormState>({ subjectId: "", title: "", description: "", order: "1", status: "published" });
  const [errors, setErrors] = useState<Partial<Record<keyof TopicFormState, string>>>({});
  const [pendingDelete, setPendingDelete] = useState<Topic | null>(null);

  const semesters = useMemo(
    () => db.semesters.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order),
    [db.semesters],
  );

  const subjects = useMemo(
    () =>
      db.subjects
        .filter((s) => !s.deletedAt && (!semesterFilter || s.semesterId === semesterFilter))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [db.subjects, semesterFilter],
  );

  /** Topics grouped by subject for display. */
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subjects
      .map((subject) => ({
        subject,
        topics: db.topics
          .filter((t) => !t.deletedAt && t.subjectId === subject.id)
          .filter((t) => !q || t.title.toLowerCase().includes(q))
          .sort((a, b) => a.order - b.order),
      }))
      .filter((g) => (!subjectFilter || g.subject.id === subjectFilter) && g.topics.length > 0);
  }, [db.topics, db.subjects, subjects, query, subjectFilter]);

  const nextOrderFor = (subjectId: string): number => {
    const list = db.topics.filter((t) => !t.deletedAt && t.subjectId === subjectId);
    return list.length + 1;
  };

  const openCreate = () => {
    const subject: Subject | undefined = subjectFilter
      ? db.subjects.find((s) => s.id === subjectFilter && !s.deletedAt)
      : subjects[0];
    setEditing(null);
    setForm({
      subjectId: subject?.id ?? "",
      title: "",
      description: "",
      order: String(subject ? nextOrderFor(subject.id) : 1),
      status: "published",
    });
    setFormOpen(true);
  };

  const openEdit = (t: Topic) => {
    setEditing(t);
    setForm({
      subjectId: t.subjectId,
      title: t.title,
      description: t.description ?? "",
      order: String(t.order),
      status: t.status,
    });
    setFormOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.subjectId) next.subjectId = "Select a subject.";
    if (!form.title.trim()) next.title = "Topic name is required.";
    if (!form.order || Number(form.order) < 1) next.order = "Order must be ≥ 1.";
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
      toast("Topic created");
    }
    setFormOpen(false);
  };

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
          <Button onClick={openCreate} disabled={subjects.length === 0}>
            <Plus className="size-4" aria-hidden="true" /> Add Topic
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          placeholder="Search topics..."
          className="max-w-md flex-1"
          onSubmit={setQuery}
          onChange={setQuery}
        />
        <div className="flex gap-3">
          <Select
            id="topics-semester-filter"
            label=""
            value={semesterFilter}
            onChange={(e) => {
              setSemesterFilter(e.target.value);
              setSubjectFilter("");
            }}
            className="w-full sm:w-48"
            aria-label="Filter by semester"
            options={[
              { value: "", label: "All semesters" },
              ...semesters.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <Select
            id="topics-subject-filter"
            label=""
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="w-full sm:w-56"
            aria-label="Filter by subject"
            disabled={!semesterFilter}
            options={[
              { value: "", label: semesterFilter ? "All subjects" : "Choose semester" },
              ...subjects.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          title="No topics"
          message={subjects.length === 0 ? "Add a subject first." : "No topics match your search or filters."}
          actionLabel={subjects.length > 0 ? "Add Topic" : undefined}
          onAction={subjects.length > 0 ? openCreate : undefined}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ subject, topics }) => (
            <section key={subject.id} aria-labelledby={`topics-${subject.id}`}>
              <h2
                id={`topics-${subject.id}`}
                className="mb-2.5 flex flex-wrap items-baseline gap-x-2 text-sm font-bold uppercase tracking-wide text-muted-foreground"
              >
                {subject.name}
                <span className="font-semibold normal-case text-muted-foreground/70">
                  ({subject.code})
                </span>
              </h2>
              <Card className="overflow-hidden">
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-border">
                    {topics.map((t, i) => (
                      <tr key={t.id} className="transition-colors hover:bg-surface-hover">
                        <td className="w-24 px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className="w-6 text-xs font-bold text-muted-foreground">
                              {String(t.order).padStart(2, "0")}
                            </span>
                            <IconButton
                              icon={ArrowUp}
                              label={`Move ${t.title} up`}
                              size="sm"
                              disabled={i === 0}
                              onClick={() => reorderTopics(t.id, -1)}
                            />
                            <IconButton
                              icon={ArrowDown}
                              label={`Move ${t.title} down`}
                              size="sm"
                              disabled={i === topics.length - 1}
                              onClick={() => reorderTopics(t.id, 1)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{t.title}</p>
                          {t.description && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">{t.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusToggleGroup
                            value={t.status}
                            onChange={(next) => updateTopic(t.id, { status: next })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton icon={Pencil} label={`Edit ${t.title}`} size="sm" onClick={() => openEdit(t)} />
                            <IconButton
                              icon={Trash2}
                              label={`Delete ${t.title}`}
                              size="sm"
                              variant="danger"
                              onClick={() => setPendingDelete(t)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit Topic" : "Add Topic"}
      >
        <form onSubmit={handleSubmit} noValidate className="mt-2 space-y-4">
          <Select
            id="topic-subject"
            label="Subject"
            value={form.subjectId}
            error={errors.subjectId}
            disabled={Boolean(editing)}
            onChange={(e) =>
              setForm((p) => ({ ...p, subjectId: e.target.value, order: String(nextOrderFor(e.target.value)) }))
            }
            options={[
              { value: "", label: "Select subject..." },
              ...subjects.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` })),
            ]}
          />
          <Input
            id="topic-title"
            label="Topic name"
            placeholder="e.g. Normalization"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            error={errors.title}
          />
          <Textarea
            id="topic-description"
            label="Description (optional)"
            rows={3}
            placeholder="Short description shown in the accordion..."
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="topic-order"
              label="Order"
              type="number"
              min={1}
              value={form.order}
              onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
              error={errors.order}
            />
            <Select
              id="topic-status"
              label="Status"
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Topic["status"] }))}
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
            <Button type="submit">{editing ? "Save changes" : "Create topic"}</Button>
          </div>
        </form>
      </Modal>

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
