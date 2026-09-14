import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import {
  CheckCircle2, CloudUpload, FileText, FileUp, FolderOpen, Info, RotateCcw, X,
} from "lucide-react";
import type { Resource, ResourceType } from "../../types";
import { Modal } from "../common/Modal";
import { Input, Select, Textarea } from "../common/Field";
import { Button } from "../common/Button";
import { StatusToggleGroup } from "./StatusBadge";
import { CascadeSelects } from "./CascadeSelects";
import { ALL_RESOURCE_TYPES, resourceTypeLabel } from "../../lib/resourceType";
import { cx, formatFileSize } from "../../lib/utils";
import { useCms } from "../../state/CmsProvider";
import { createResource, updateResource, branchResourceToDraft, getAllTags } from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";

/**
 * Sectioned Add/Edit Resource modal used by the Admin Resources page.
 * - Creating: a PDF "upload" (client-side metadata) is required.
 * - Editing: metadata only — the existing file is kept unless replaced.
 * - Past Paper type reveals year/full marks/duration metadata.
 */

interface ResourceEditorModalProps {
  open: boolean;
  onClose: () => void;
  /** Existing resource to edit; omit to create a new one. */
  editing?: Resource;
  /** Preselected semester/subject (from the page's filter context). */
  defaultSemesterId?: string;
  defaultSubjectId?: string;
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

function emptyForm(defaultSemesterId?: string, defaultSubjectId?: string): FormState {
  return {
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
  };
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

export function ResourceEditorModal({
  open,
  onClose,
  editing,
  defaultSemesterId,
  defaultSubjectId,
}: ResourceEditorModalProps) {
  const db = useCms();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() =>
    editing ? toForm(editing) : emptyForm(defaultSemesterId, defaultSubjectId),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "file", string>>>({});
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const suggestions = useMemo(() => getAllTags().slice(0, 8), [db]);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setErrors({});
    setForm(editing ? toForm(editing) : emptyForm(defaultSemesterId, defaultSubjectId));
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

  const save = (status: Resource["status"]) => {
    if (!validate()) return;

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
      paperYear: form.type === "past_paper" && form.paperYear ? Number(form.paperYear) : undefined,
      paperFullMarks: form.type === "past_paper" && form.paperFullMarks ? Number(form.paperFullMarks) : undefined,
      paperDurationMinutes: form.type === "past_paper" && form.paperDuration ? Number(form.paperDuration) : undefined,
      status,
    };

    if (editing) {
      // Editing a published/hidden resource + Save as Draft → keep the live
      // version untouched and stage the edits as a new draft in Drafts.
      if (status === "draft" && editing.status !== "draft") {
        branchResourceToDraft(editing.id, {
          ...base,
          fileName: file?.name ?? editing.fileName,
          fileSize: file?.size ?? editing.fileSize,
        });
        toast("Edits saved as a new draft — the published resource is unchanged");
      } else {
        updateResource(editing.id, {
          ...base,
          fileName: file?.name ?? editing.fileName,
          fileSize: file?.size ?? editing.fileSize,
        });
        toast("Resource updated");
      }
    } else {
      createResource({
        ...base,
        fileName: file!.name,
        fileSize: file!.size,
      });
      toast("Resource added");
    }
    onClose();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    save(form.status);
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
                hint={suggestions.length > 0 ? `Existing: ${suggestions.slice(0, 5).map((t) => t.name).join(", ")}` : undefined}
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
              PDFs will be stored using Cloudinary later — for now the file is kept locally in this form.
            </p>
          </fieldset>
        </div>

        {/* BOTTOM — Cancel / Save as Draft / Save & Publish */}
        <div className="mt-5 flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="outline" type="button" onClick={() => save("draft")}>
            Save as Draft
          </Button>
          <Button type="submit">
            {form.status === "hidden" ? "Save as Hidden" : form.status === "draft" ? "Save Draft" : "Save & Publish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
