import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import { CloudUpload, FileText, CheckCircle2 } from "lucide-react";
import type { Resource, ResourceType } from "../../types";
import { Modal } from "../common/Modal";
import { Input, Select, Textarea } from "../common/Field";
import { Button } from "../common/Button";
import { StatusToggleGroup } from "./StatusBadge";
import { CascadeSelects } from "./CascadeSelects";
import { ALL_RESOURCE_TYPES, resourceTypeLabel } from "../../lib/resourceType";
import { cx, formatFileSize } from "../../lib/utils";
import { useCms } from "../../state/CmsProvider";
import { createResource, updateResource, getAllTags } from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";

/**
 * ONE universal Add/Edit Resource dialog for every resource type.
 * - Creating: a PDF "upload" (client-side metadata for now) is required.
 * - Editing: metadata only — the existing file is kept, no re-upload needed.
 * - Past Paper type reveals year/full marks/duration metadata.
 */

interface ResourceFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Existing resource to edit; omit to create a new one. */
  editing?: Resource;
  /** Preselected semester (from an admin page's filter context). */
  defaultSemesterId?: string;
  defaultSubjectId?: string;
  onSaved?: (id: string) => void;
}

interface FormState {
  title: string;
  description: string;
  semesterId: string;
  subjectId: string;
  topicId: string;
  bookId: string;
  type: ResourceType;
  tags: string;
  pageCount: string;
  paperYear: string;
  paperFullMarks: string;
  paperDuration: string;
  featured: boolean;
  status: Resource["status"];
}

function toForm(r: Resource): FormState {
  return {
    title: r.title,
    description: r.description,
    semesterId: r.semesterId,
    subjectId: r.subjectId,
    topicId: r.topicId ?? "",
    bookId: r.bookId ?? "",
    type: r.type,
    tags: r.tags.join(", "),
    pageCount: String(r.pageCount || ""),
    paperYear: r.paperYear ? String(r.paperYear) : "",
    paperFullMarks: r.paperFullMarks ? String(r.paperFullMarks) : "",
    paperDuration: r.paperDurationMinutes ? String(r.paperDurationMinutes) : "",
    featured: r.featured,
    status: r.status,
  };
}

export function ResourceFormModal({
  open,
  onClose,
  editing,
  defaultSemesterId,
  defaultSubjectId,
  onSaved,
}: ResourceFormModalProps) {
  const db = useCms();
  const [form, setForm] = useState<FormState>(() =>
    editing
      ? toForm(editing)
      : {
          title: "",
          description: "",
          semesterId: defaultSemesterId ?? "",
          subjectId: defaultSubjectId ?? "",
          topicId: "",
          bookId: "",
          type: "short_note",
          tags: "",
          pageCount: "",
          paperYear: "",
          paperFullMarks: "",
          paperDuration: "",
          featured: false,
          status: "published",
        },
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "file", string>>>({});
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const books = useMemo(
    () => db.books.filter((b) => !b.deletedAt && (!form.semesterId || b.semesterId === form.semesterId)),
    [db.books, form.semesterId],
  );
  const suggestions = useMemo(() => getAllTags().slice(0, 12), [db.resources]);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setErrors({});
    setForm(
      editing
        ? toForm(editing)
        : {
            title: "",
            description: "",
            semesterId: defaultSemesterId ?? "",
            subjectId: defaultSubjectId ?? "",
            topicId: "",
            bookId: "",
            type: "short_note",
            tags: "",
            pageCount: "",
            paperYear: "",
            paperFullMarks: "",
            paperDuration: "",
            featured: false,
            status: "published",
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const parseTags = (raw: string): string[] =>
    raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .filter((t, i, arr) => arr.indexOf(t) === i);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.title.trim()) next.title = "Title is required.";
    if (!form.semesterId) next.semesterId = "Select a semester.";
    if (!form.subjectId) next.subjectId = "Select a subject.";
    if (!editing && !file) next.file = "Select a PDF file to upload.";
    if (!form.pageCount || Number(form.pageCount) < 1) next.pageCount = "Enter the page count.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) acceptFile(dropped);
  };

  const acceptFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") return;
    setFile(f);
    setErrors((prev) => ({ ...prev, file: undefined }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);

    const tags = parseTags(form.tags);
    const base = {
      title: form.title.trim(),
      description: form.description.trim(),
      semesterId: form.semesterId,
      subjectId: form.subjectId,
      topicId: form.topicId || undefined,
      bookId: form.bookId || undefined,
      type: form.type,
      pageCount: Number(form.pageCount),
      tags,
      featured: form.featured,
      paperYear: form.type === "past_paper" && form.paperYear ? Number(form.paperYear) : undefined,
      paperFullMarks: form.type === "past_paper" && form.paperFullMarks ? Number(form.paperFullMarks) : undefined,
      paperDurationMinutes: form.type === "past_paper" && form.paperDuration ? Number(form.paperDuration) : undefined,
      status: form.status,
    };

    try {
      if (editing) {
        updateResource(editing.id, base);
        toast("Resource updated");
        onSaved?.(editing.id);
      } else {
        const created = createResource({
          ...base,
          fileName: file!.name,
          fileSize: file!.size,
        });
        toast("Resource added");
        onSaved?.(created.id);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit Resource" : "Add Resource"}
      className="max-w-3xl"
    >
      <form onSubmit={handleSubmit} noValidate className="mt-2 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="res-title"
            label="Title"
            placeholder="e.g. DSA Short Notes — Arrays to Graphs"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            error={errors.title}
          />
          <Select
            id="res-type"
            label="Resource type"
            value={form.type}
            onChange={(e) => set("type", e.target.value as ResourceType)}
            options={ALL_RESOURCE_TYPES.map((t) => ({ value: t, label: resourceTypeLabel(t) }))}
          />
        </div>

        <Textarea
          id="res-description"
          label="Description"
          rows={3}
          placeholder="Short summary of the resource..."
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <CascadeSelects
            semesterId={form.semesterId}
            subjectId={form.subjectId}
            topicId={form.topicId}
            topicOptional
            onSemesterChange={(id) => {
              set("semesterId", id);
              set("subjectId", "");
              set("topicId", "");
            }}
            onSubjectChange={(id) => {
              set("subjectId", id);
              set("topicId", "");
            }}
            onTopicChange={(id) => set("topicId", id)}
            showErrors={{ semesterId: errors.semesterId, subjectId: errors.subjectId }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            id="res-tags"
            label="Tags"
            placeholder="comma-separated"
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
            hint={suggestions.length > 0 ? `Existing: ${suggestions.slice(0, 6).map((t) => t.name).join(", ")}` : undefined}
          />
          <Input
            id="res-pages"
            label="Page count"
            type="number"
            min={1}
            placeholder="e.g. 120"
            value={form.pageCount}
            onChange={(e) => set("pageCount", e.target.value)}
            error={errors.pageCount}
          />
          <Select
            id="res-book"
            label="Link a book (optional)"
            value={form.bookId}
            onChange={(e) => set("bookId", e.target.value)}
            options={[
              { value: "", label: "None" },
              ...books.map((b) => ({ value: b.id, label: b.title })),
            ]}
          />
        </div>

        {/* Past-paper metadata */}
        {form.type === "past_paper" && (
          <div className="grid gap-4 rounded-xl border border-warning/30 bg-warning-muted/30 p-4 sm:grid-cols-3">
            <Input
              id="res-paper-year"
              label="Year"
              type="number"
              min={2000}
              max={2100}
              placeholder="e.g. 2024"
              value={form.paperYear}
              onChange={(e) => set("paperYear", e.target.value)}
            />
            <Input
              id="res-paper-marks"
              label="Full marks"
              type="number"
              min={1}
              placeholder="e.g. 60"
              value={form.paperFullMarks}
              onChange={(e) => set("paperFullMarks", e.target.value)}
            />
            <Input
              id="res-paper-duration"
              label="Duration (minutes)"
              type="number"
              min={1}
              placeholder="e.g. 180"
              value={form.paperDuration}
              onChange={(e) => set("paperDuration", e.target.value)}
            />
          </div>
        )}

        {/* File — required on create, kept on edit */}
        <div>
          <p className="text-sm font-semibold text-foreground">
            PDF file {editing && <span className="font-normal text-muted-foreground">(current file is kept)</span>}
          </p>
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload PDF file"
            onClick={() => document.getElementById("res-file-input")?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") document.getElementById("res-file-input")?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={cx(
              "mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              dragActive
                ? "border-primary bg-primary-muted"
                : editing
                  ? "border-border-strong hover:border-primary/50 hover:bg-surface-hover"
                  : file
                    ? "border-success bg-success-muted/50"
                    : "border-border-strong hover:border-primary/50 hover:bg-surface-hover",
            )}
          >
            {file ? (
              <>
                <CheckCircle2 className="size-8 text-success" aria-hidden="true" />
                <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <FileText className="size-4" aria-hidden="true" />
                  {file.name}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  {formatFileSize(file.size)} · Click to replace
                </p>
              </>
            ) : editing ? (
              <>
                <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs font-medium text-muted-foreground">
                  {editing.fileName} · {formatFileSize(editing.fileSize)} — drop a new PDF only to replace
                </p>
              </>
            ) : (
              <>
                <CloudUpload className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-bold text-foreground">Drag &amp; drop your PDF here</p>
                <p className="text-xs font-medium text-muted-foreground">or click to browse files</p>
              </>
            )}
          </div>
          {errors.file && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-error">
              {errors.file}
            </p>
          )}
          <input
            id="res-file-input"
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) acceptFile(f);
            }}
          />
        </div>

        {/* Featured + status */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/50 px-4 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => set("featured", e.target.checked)}
              className="size-4 rounded border-border-strong text-primary focus:ring-primary/25"
            />
            Featured resource
          </label>
          <StatusToggleGroup value={form.status} onChange={(s) => set("status", s)} size="md" />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {editing ? "Save changes" : "Add resource"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
