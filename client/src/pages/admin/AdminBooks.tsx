import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2, Plus, Eye } from "lucide-react";
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
import { createBook, updateBook, softDelete } from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import { formatFileSize } from "../../lib/utils";
import type { Book } from "../../types";

interface BookFormState {
  title: string;
  author: string;
  description: string;
  edition: string;
  semesterId: string;
  subjectId: string;
  resourceId: string;
  pageCount: string;
  status: Book["status"];
}

export default function AdminBooks() {
  const db = useCms();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [form, setForm] = useState<BookFormState>({
    title: "", author: "", description: "", edition: "",
    semesterId: "", subjectId: "", resourceId: "", pageCount: "", status: "published",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof BookFormState, string>>>({});
  const [pendingDelete, setPendingDelete] = useState<Book | null>(null);

  const semesters = useMemo(
    () => db.semesters.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order),
    [db.semesters],
  );

  const books = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.books
      .filter((b) => !b.deletedAt)
      .filter((b) => !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [db.books, query]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "", author: "", description: "", edition: "",
      semesterId: semesters[0]?.id ?? "", subjectId: "", resourceId: "", pageCount: "", status: "published",
    });
    setFormOpen(true);
  };

  const openEdit = (b: Book) => {
    setEditing(b);
    setForm({
      title: b.title,
      author: b.author,
      description: b.description,
      edition: b.edition,
      semesterId: b.semesterId,
      subjectId: b.subjectId,
      resourceId: b.resourceId ?? "",
      pageCount: b.pageCount ? String(b.pageCount) : "",
      status: b.status,
    });
    setFormOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.title.trim()) next.title = "Title is required.";
    if (!form.author.trim()) next.author = "Author is required.";
    if (!form.semesterId) next.semesterId = "Select a semester.";
    if (!form.subjectId) next.subjectId = "Select a subject.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const linked = form.resourceId ? db.resources.find((r) => r.id === form.resourceId) : undefined;
    const draft = {
      title: form.title.trim(),
      author: form.author.trim(),
      description: form.description.trim(),
      edition: form.edition.trim(),
      semesterId: form.semesterId,
      subjectId: form.subjectId,
      resourceId: form.resourceId || undefined,
      pageCount: Number(form.pageCount) || linked?.pageCount || 0,
      fileSize: linked?.fileSize ?? 0,
      status: form.status,
    };
    if (editing) {
      updateBook(editing.id, draft);
      toast("Book updated");
    } else {
      createBook(draft);
      toast("Book created");
    }
    setFormOpen(false);
  };

  const subjectsFor = (semesterId: string) =>
    db.subjects.filter((s) => !s.deletedAt && s.semesterId === semesterId);

  const pdfResourcesFor = (semesterId: string, subjectId: string) =>
    db.resources
      .filter(
        (r) => !r.deletedAt && r.semesterId === semesterId && r.subjectId === subjectId && r.type === "book",
      )
      .concat(
        db.resources.filter(
          (r) =>
            !r.deletedAt &&
            r.semesterId === semesterId &&
            !subjectId &&
            r.type === "book" &&
            !db.resources.some((x) => x.id === r.id),
        ),
      );

  return (
    <div>
      <PageHeader
        title="Books"
        subtitle="Textbooks and reference books. Link a PDF resource to reuse the reader & download system."
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Books" },
        ]}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" /> Add Book
          </Button>
        }
      />

      <div className="mb-4">
        <SearchBar
          placeholder="Search books..."
          className="max-w-md"
          onSubmit={setQuery}
          onChange={setQuery}
        />
      </div>

      {books.length === 0 ? (
        <EmptyState
          title="No books"
          message="Add your first textbook or reference book."
          actionLabel="Add Book"
          onAction={openCreate}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground/70">
                  <th scope="col" className="px-4 py-3 font-medium">Book</th>
                  <th scope="col" className="px-4 py-3 font-medium">Semester / Subject</th>
                  <th scope="col" className="px-4 py-3 font-medium">PDF</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {books.map((b) => {
                  const semester = db.semesters.find((s) => s.id === b.semesterId);
                  const subject = db.subjects.find((s) => s.id === b.subjectId);
                  const resource = b.resourceId ? db.resources.find((r) => r.id === b.resourceId) : undefined;
                  return (
                    <tr key={b.id} className="transition-colors hover:bg-surface-hover">
                      <td className="max-w-xs px-4 py-3">
                        <p className="line-clamp-1 font-medium text-foreground">{b.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground/70">
                          {b.author}
                          {b.edition && ` · ${b.edition}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {semester?.name ?? "—"}
                        <span className="block text-xs">{subject?.name ?? ""}</span>
                      </td>
                      <td className="px-4 py-3">
                        {resource ? (
                          <Link
                            to={`/resources/${resource.id}`}
                            className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                          >
                            <Eye className="size-3.5" aria-hidden="true" />
                            {formatFileSize(resource.fileSize)}
                          </Link>
                        ) : (
                          <span className="text-xs font-medium text-muted-foreground/60">Not linked</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusToggleGroup
                          value={b.status}
                          onChange={(next) => updateBook(b.id, { status: next })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton icon={Pencil} label={`Edit ${b.title}`} size="sm" onClick={() => openEdit(b)} />
                          <IconButton
                            icon={Trash2}
                            label={`Delete ${b.title}`}
                            size="sm"
                            variant="danger"
                            onClick={() => setPendingDelete(b)}
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
        title={editing ? "Edit Book" : "Add Book"}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} noValidate className="mt-2 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="book-title"
              label="Title"
              placeholder="e.g. Operating System Concepts"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              error={errors.title}
            />
            <Input
              id="book-author"
              label="Author"
              placeholder="e.g. Silberschatz"
              value={form.author}
              onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
              error={errors.author}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="book-edition"
              label="Edition (optional)"
              placeholder="e.g. 10th"
              value={form.edition}
              onChange={(e) => setForm((p) => ({ ...p, edition: e.target.value }))}
            />
            <Input
              id="book-pages"
              label="Page count"
              type="number"
              min={1}
              placeholder="e.g. 1150"
              value={form.pageCount}
              onChange={(e) => setForm((p) => ({ ...p, pageCount: e.target.value }))}
            />
          </div>
          <Textarea
            id="book-description"
            label="Description"
            rows={3}
            placeholder="Short summary of the book..."
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              id="book-semester"
              label="Semester"
              value={form.semesterId}
              error={errors.semesterId}
              onChange={(e) => setForm((p) => ({ ...p, semesterId: e.target.value, subjectId: "", resourceId: "" }))}
              options={[
                { value: "", label: "Select semester..." },
                ...semesters.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <Select
              id="book-subject"
              label="Subject"
              value={form.subjectId}
              error={errors.subjectId}
              disabled={!form.semesterId}
              onChange={(e) => setForm((p) => ({ ...p, subjectId: e.target.value, resourceId: "" }))}
              options={[
                { value: "", label: form.semesterId ? "Select subject..." : "Choose a semester first" },
                ...subjectsFor(form.semesterId).map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` })),
              ]}
            />
          </div>
          <Select
            id="book-resource"
            label="PDF file (link an existing book resource)"
            value={form.resourceId}
            disabled={!form.semesterId}
            onChange={(e) => setForm((p) => ({ ...p, resourceId: e.target.value }))}
            options={[
              { value: "", label: "No linked PDF" },
              ...pdfResourcesFor(form.semesterId, form.subjectId).map((r) => ({
                value: r.id,
                label: `${r.title} (${formatFileSize(r.fileSize)})`,
              })),
            ]}
          />
          <Select
            id="book-status"
            label="Status"
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Book["status"] }))}
            options={[
              { value: "published", label: "Published" },
              { value: "draft", label: "Draft" },
              { value: "hidden", label: "Hidden" },
            ]}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Save changes" : "Create book"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete book"
        message={`"${pendingDelete?.title}" will move to the trash. Linked resources are not affected.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            softDelete("book", pendingDelete.id);
            toast("Book moved to trash");
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
