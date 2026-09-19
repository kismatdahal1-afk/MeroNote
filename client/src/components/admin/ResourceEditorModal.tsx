import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import {
  CheckCircle2, CloudUpload, FileText, FileUp, FolderOpen, Info, RotateCcw, X,
} from "lucide-react";
import type { Resource, ResourceType } from "../../types";
import { Modal } from "../common/Modal";
import { Input, Select, Textarea } from "../common/Field";
import { Button } from "../common/Button";
import { StatusToggleGroup } from "./StatusBadge";
import { ALL_RESOURCE_TYPES, resourceTypeLabel } from "../../lib/resourceType";
import { cx, formatFileSize } from "../../lib/utils";
import { fetchSemesters, fetchSubjects } from "../../lib/contentApi";
import { adminCreate, adminUpdate, adminUploadFile } from "../../lib/adminApi";
import { executeResourceSave } from "../../lib/resourceSaveFlow";
import { ApiError } from "../../lib/contentApi";
import { useApiQuery } from "../../hooks/useApiQuery";
import { useToast } from "../../state/ToastProvider";

/**
 * Sectioned Add/Edit Resource modal used by the Admin Resources page.
 * - Creating: a PDF "upload" (client-side metadata) is required.
 * - Editing: metadata only — the existing file is kept unless replaced.
 * - Past Paper type reveals year/full marks/duration metadata.
 * - Resource Type "Custom" reveals a text input for admin-entered type.
 * - Topic has been removed — organization is Semester + Subject only.
 */

interface ResourceEditorModalProps {
  open: boolean;
  onClose: () => void;
  /** Existing resource to edit; omit to create a new one. */
  editing?: Resource;
  /** Preselected semester/subject (from the page's filter context). */
  defaultSemesterId?: string;
  defaultSubjectId?: string;
  /** Refresh callback after a successful save (parent refetches its list). */
  onSaved?: () => void;
}

interface FormState {
  title: string;
  description: string;
  semesterId: string;
  subjectId: string;
  bookId: string;
  type: ResourceType;
  customType: string;
  tags: string;
  pageCount: string;
  paperYear: string;
  paperFullMarks: string;
  paperDuration: string;
  featured: boolean;
  status: Resource["status"];
  hidden?: boolean;
}

function emptyForm(defaultSemesterId?: string, defaultSubjectId?: string): FormState {  return {
    title: "",
    description: "",
    semesterId: defaultSemesterId ?? "",
    subjectId: defaultSubjectId ?? "",
    bookId: "",
    type: "short_note",
    customType: "",
    tags: "",
    pageCount: "",
    paperYear: "",
    paperFullMarks: "",
    paperDuration: "",
    featured: false,
    status: "draft",
    hidden: false,
  };
}

function toForm(r: Resource): FormState {
  return {
    title: r.title,
    description: r.description,
    semesterId: r.semesterId,
    subjectId: r.subjectId,
    bookId: r.bookId ?? "",
    type: r.type,
    customType: r.customType ?? "",
    tags: r.tags.join(", "),
    pageCount: String(r.pageCount || ""),
    paperYear: r.paperYear ? String(r.paperYear) : "",
    paperFullMarks: r.paperFullMarks ? String(r.paperFullMarks) : "",
    paperDuration: r.paperDurationMinutes ? String(r.paperDurationMinutes) : "",
    featured: r.featured,
    status: r.status,
    hidden: r.hidden,
  };
}

export function ResourceEditorModal({
  open,
  onClose,
  editing,
  defaultSemesterId,
  defaultSubjectId,
  onSaved,
}: ResourceEditorModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() =>
    editing ? toForm(editing) : emptyForm(defaultSemesterId, defaultSubjectId),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "file" | "customType", string>>>({});
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: semestersData } = useApiQuery("admin-modal-semesters", () => fetchSemesters());
  const { data: subjectsData } = useApiQuery(`admin-modal-subjects-${form.semesterId}`, (signal) =>
    form.semesterId ? fetchSubjects(form.semesterId, signal) : Promise.resolve({ rows: [], total: 0 }),
  );

  const semesters = useMemo(
    () => [...(semestersData?.rows ?? [])].sort((a, b) => a.order - b.order),
    [semestersData],
  );
  const subjects = useMemo(() => subjectsData?.rows ?? [], [subjectsData]);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setErrors({});
    setForm(editing ? toForm(editing) : emptyForm(defaultSemesterId, defaultSubjectId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, ...(key === "type" ? { customType: undefined } : {}) }));
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
    if (!form.description.trim()) next.description = "Description is required.";
    if (!form.semesterId) next.semesterId = "Select a semester.";
    if (!form.subjectId) next.subjectId = "Select a subject.";
    if (form.type === "custom" && !form.customType.trim()) next.customType = "Enter custom type.";
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

  const save = async (status: Resource["status"]) => {
    if (!validate() || saving) return;
    setSaving(true);

    const tags = parseTags(form.tags);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      semesterId: form.semesterId,
      subjectId: form.subjectId,
      topicId: undefined,
      bookId: form.bookId || undefined,
      type: form.type,
      customType: form.type === "custom" ? form.customType.trim() : undefined,
      pageCount: Number(form.pageCount),
      tags,
      paperYear: form.type === "past_paper" && form.paperYear ? Number(form.paperYear) : undefined,
      paperFullMarks: form.type === "past_paper" && form.paperFullMarks ? Number(form.paperFullMarks) : undefined,
      paperDurationMinutes: form.type === "past_paper" && form.paperDuration ? Number(form.paperDuration) : undefined,
      status,
      hidden: form.hidden,
    };

    /** Upload the selected file; on failure the modal stays open on the file field. */
    const failOnFile = (message: string) => {
      setErrors((prev) => ({ ...prev, file: message }));
    };

    const deps = {
      create: (body: Record<string, unknown>) => adminCreate<{ id: string }>("resources", body),
      update: (id: string, body: Record<string, unknown>) => adminUpdate("resources", id, body),
      upload: (id: string, f: File, pc?: number) => adminUploadFile(id, f, pc),
    };

    try {
      if (editing) {
        // Editing a published/hidden resource + Save as Draft → keep the live
        // version untouched and stage the edits as a new draft.
        if (status === "draft" && editing.status !== "draft") {
          const result = await executeResourceSave(deps, {
            isNew: false,
            saveAsNewDraft: true,
            payload,
            status,
            file,
            pageCount: Number(form.pageCount) || undefined,
            hasStoredFile: Boolean(editing.fileName),
          });
          if (!result.ok) {
            failOnFile(result.message);
            if (result.reason === "upload-failed") {
              toast("Draft created, but the file upload failed — replace it from Edit");
              onSaved?.();
              onClose();
            }
            return;
          }
          toast("Edits saved as a new draft — the published resource is unchanged");
        } else {
          const result = await executeResourceSave(deps, {
            isNew: false,
            editingId: editing.id,
            payload,
            status,
            file,
            pageCount: Number(form.pageCount) || undefined,
            hasStoredFile: Boolean(editing.fileName),
          });
          if (!result.ok) {
            if (result.reason === "blocked-no-file") {
              failOnFile(result.message);
              return;
            }
            if (result.reason === "upload-failed") {
              failOnFile(result.message);
              // A staged publish never happened: stay open on the file field.
              // Otherwise preserve legacy behavior (metadata saved, old file
              // intact — the backend swap never ran).
              if (status !== "published" || !file || Boolean(editing.fileName)) {
                toast("Resource updated, but the file upload failed");
                onSaved?.();
                onClose();
              }
              return;
            }
            toast("File uploaded, but publishing failed — resource kept as draft.", "error");
            onSaved?.();
            return;
          }
          toast("Resource updated");
        }
      } else {
        const result = await executeResourceSave(deps, {
          isNew: true,
          payload,
          status,
          file,
          pageCount: Number(form.pageCount) || undefined,
          hasStoredFile: false,
        });
        if (!result.ok) {
          if (result.reason === "publish-failed") {
            toast("File uploaded, but publishing failed — resource kept as draft.", "error");
            onSaved?.();
            return;
          }
          failOnFile(result.message);
          return;
        }
        toast("Resource added");
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not save the resource.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void save(form.status);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit Resource" : "Add Resource"}
      className="max-w-3xl lg:max-w-none lg:w-[68rem]"
    >
      <form onSubmit={handleSubmit} noValidate className="mt-4 text-left">
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:gap-8">
          {/* LEFT — Resource Information */}
          <fieldset className="min-w-0">
            <legend className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Resource Information
            </legend>
            <div className="mt-3 space-y-5">
              <div className="grid gap-4 sm:grid-cols-[1fr_13rem]">
                <Input
                  id="res-title"
                  label="Resource Title"
                  placeholder="e.g. DSA Short Notes — Arrays to Graphs"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  error={errors.title}
                />
                <Select
                  id="res-type"
                  label="Resource Type"
                  value={form.type}
                  onChange={(e) => set("type", e.target.value as ResourceType)}
                  options={ALL_RESOURCE_TYPES.map((t) => ({ value: t, label: resourceTypeLabel(t) }))}
                />
              </div>
              {form.type === "custom" && (
                <Input
                  id="res-custom-type"
                  label="Custom Type"
                  placeholder="e.g. Lab Manual"
                  value={form.customType}
                  onChange={(e) => set("customType", e.target.value)}
                  error={errors.customType}
                />
              )}
              <Textarea
                id="res-description"
                label="Description"
                rows={3}
                placeholder="Short summary of the resource..."
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                error={errors.description}
              />
              <Input
                id="res-tags"
                label="Tags"
                placeholder="comma-separated"
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                hint="Separate multiple tags with commas"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  id="res-semester"
                  label="Semester"
                  value={form.semesterId}
                  error={errors.semesterId}
                  onChange={(e) => {
                    set("semesterId", e.target.value);
                    set("subjectId", "");
                  }}
                  options={[
                    { value: "", label: "Select semester..." },
                    ...semesters.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
                <Select
                  id="res-subject"
                  label="Subject"
                  value={form.subjectId}
                  disabled={!form.semesterId}
                  error={errors.subjectId}
                  onChange={(e) => set("subjectId", e.target.value)}
                  options={[
                    {
                      value: "",
                      label: form.semesterId ? "Select subject..." : "Choose a semester first",
                    },
                    ...subjects.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` })),
                  ]}
                />
              </div>

              {/* Pages + Status — one compact, aligned row */}
              <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                <Input
                  id="res-pages"
                  label="Pages"
                  type="number"
                  min={1}
                  placeholder="e.g. 120"
                  value={form.pageCount}
                  onChange={(e) => set("pageCount", e.target.value)}
                  error={errors.pageCount}
                />
                <div className="space-y-1.5">
                  <span className="block text-sm font-semibold text-foreground">Status</span>
                  <div className="flex h-10 items-center">
                    <StatusToggleGroup value={form.status} onChange={(s) => set("status", s)} size="md" />
                  </div>
                </div>
              </div>

              {/* Past-paper metadata (only for past papers) */}
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
            </div>
          </fieldset>

          {/* RIGHT — File Upload (fills the column, mirrors Add Topic's drop area) */}
          <fieldset className="min-w-0 rounded-xl border border-border-strong bg-surface-muted/60 p-4 lg:flex lg:flex-col">
            <legend className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              PDF Upload
            </legend>
            <div className="mt-2 flex items-center gap-2 lg:mt-0">
              <FileUp className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="text-sm font-bold text-foreground">Resource File</span>
              {!editing && <span className="text-xs font-medium text-muted-foreground">(required)</span>}
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={cx(
                "mt-3 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center",
                "transition-colors lg:flex-1 lg:py-10 py-8",
                dragActive
                  ? "border-primary bg-primary-muted"
                  : file
                    ? "border-success bg-success-muted/40"
                    : "border-border-strong bg-surface hover:border-primary/50",
              )}
            >
              {file ? (
                <>
                  <span className="flex size-12 items-center justify-center rounded-xl bg-success-muted text-success">
                    <CheckCircle2 className="size-6" aria-hidden="true" />
                  </span>
                  <p className="mt-3 flex max-w-full items-center gap-1.5 text-sm font-bold text-foreground">
                    <FileText className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{file.name}</span>
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                    {formatFileSize(file.size)} · PDF ready
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => document.getElementById("res-file-input")?.click()}
                    >
                      <RotateCcw className="size-4" aria-hidden="true" /> Replace
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="text-error hover:bg-error-muted hover:text-error"
                      onClick={() => setFile(null)}
                    >
                      <X className="size-4" aria-hidden="true" /> Remove
                    </Button>
                  </div>
                </>
              ) : editing ? (
                <>
                  <span className="flex size-12 items-center justify-center rounded-xl bg-surface-hover text-muted-foreground">
                    <FileText className="size-6" aria-hidden="true" />
                  </span>
                  <p className="mt-3 flex max-w-full items-center gap-1.5 text-sm font-semibold text-foreground/80">
                    <span className="truncate">{editing.fileName}</span>
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                    {formatFileSize(editing.fileSize)} · current file
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="mt-3"
                    onClick={() => document.getElementById("res-file-input")?.click()}
                  >
                    <FolderOpen className="size-4" aria-hidden="true" /> Replace File
                  </Button>
                </>
              ) : (
                <>
                  <CloudUpload className="size-9 text-muted-foreground/70" aria-hidden="true" />
                  <p className="mt-2.5 text-sm font-bold text-foreground">Drag &amp; drop your PDF here</p>
                  <p className="text-xs text-muted-foreground">or</p>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="mt-1.5"
                    onClick={() => document.getElementById("res-file-input")?.click()}
                  >
                    <FolderOpen className="size-4" aria-hidden="true" /> Choose PDF
                  </Button>
                </>
              )}
            </div>
            {errors.file && (
              <p role="alert" className="mt-2 text-xs font-medium text-error">
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
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              PDFs are stored in secure file storage and served to readers.
            </p>
          </fieldset>
        </div>

        {/* BOTTOM — status-driven primary action + Cancel (only 2 buttons) */}
        <div className="mt-5 flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : form.status === "hidden" ? "Save as Hidden" : form.status === "draft" ? "Save as Draft" : "Save & Publish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
