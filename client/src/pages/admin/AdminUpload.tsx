import { useState, type DragEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CloudUpload, FileText, ArrowLeft, CheckCircle2 } from "lucide-react";
import { PageHeader, Card } from "../../components/common/PageHeader";
import { Input, Select, Textarea } from "../../components/common/Field";
import { Button } from "../../components/common/Button";
import { Badge } from "../../components/common/Badge";
import { getAllSemesters, getSubjectsBySemester } from "../../data/selectors";
import { ALL_RESOURCE_TYPES, resourceTypeLabel } from "../../lib/resourceType";
import { cx, formatFileSize } from "../../lib/utils";
import { useToast } from "../../state/ToastProvider";
import type { ResourceType } from "../../types";

interface UploadFormState {
  title: string;
  description: string;
  semesterId: string;
  subjectId: string;
  type: ResourceType;
  tags: string;
  pageCount: string;
}

const initialForm: UploadFormState = {
  title: "",
  description: "",
  semesterId: "",
  subjectId: "",
  type: "book",
  tags: "",
  pageCount: "",
};

export default function AdminUpload() {
  const { toast } = useToast();
  const [form, setForm] = useState<UploadFormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof UploadFormState, string>>>({});
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const semesters = getAllSemesters();
  const subjects = form.semesterId ? getSubjectsBySemester(form.semesterId) : [];

  const set = <K extends keyof UploadFormState>(key: K, value: UploadFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.title.trim()) next.title = "Title is required.";
    if (!form.semesterId) next.semesterId = "Select a semester.";
    if (!form.subjectId) next.subjectId = "Select a subject.";
    if (!file) {
      // file input error rendered near the dropzone
      next.description = undefined;
    }
    setErrors(next);
    return Object.keys(next).length === 0 && file !== null;
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) acceptFile(dropped);
  };

  const acceptFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") {
      toast("Only PDF files are accepted", "error");
      return;
    }
    setFile(f);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      if (!file) toast("Select a PDF file to upload", "error");
      return;
    }
    setSubmitting(true);
    // Mock upload â€” real storage arrives in Phase 5.
    window.setTimeout(() => {
      setSubmitting(false);
      toast(`"${form.title}" uploaded (mock)`);
      setForm(initialForm);
      setFile(null);
    }, 900);
  };

  return (
    <div>
      <PageHeader
        title="Upload Resource"
        subtitle="Add a new study resource to the library. (Mock â€” nothing is stored.)"
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Upload" },
        ]}
        actions={
          <Link
            to="/admin/resources"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Manage resources
          </Link>
        }
      />

      <form onSubmit={handleSubmit} noValidate className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Resource details</h2>
          <div className="mt-5 space-y-4">
            <Input
              id="upload-title"
              label="Title"
              placeholder="e.g. DSA Short Notes â€” Arrays to Graphs"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              error={errors.title}
            />
            <Textarea
              id="upload-description"
              label="Description"
              placeholder="Short summary of the resource..."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                id="upload-semester"
                label="Semester"
                value={form.semesterId}
                onChange={(e) => {
                  set("semesterId", e.target.value);
                  set("subjectId", "");
                }}
                error={errors.semesterId}
                options={[
                  { value: "", label: "Select semester..." },
                  ...semesters.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
              <Select
                id="upload-subject"
                label="Subject"
                value={form.subjectId}
                onChange={(e) => set("subjectId", e.target.value)}
                error={errors.subjectId}
                disabled={!form.semesterId}
                options={[
                  { value: "", label: form.semesterId ? "Select subject..." : "Choose a semester first" },
                  ...subjects.map((s) => ({ value: s.id, label: `${s.code} â€” ${s.name}` })),
                ]}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                id="upload-type"
                label="Resource type"
                value={form.type}
                onChange={(e) => set("type", e.target.value as ResourceType)}
                options={ALL_RESOURCE_TYPES.map((t) => ({ value: t, label: resourceTypeLabel(t) }))}
              />
              <Input
                id="upload-pages"
                label="Page count (optional)"
                type="number"
                min={1}
                placeholder="e.g. 120"
                value={form.pageCount}
                onChange={(e) => set("pageCount", e.target.value)}
              />
            </div>
            <Input
              id="upload-tags"
              label="Tags (optional)"
              placeholder="comma-separated, e.g. notes, revision, exam"
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
              hint="Separate tags with commas."
            />
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {/* Dropzone */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">PDF file</h2>
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload PDF file"
              onClick={() => document.getElementById("upload-file-input")?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") document.getElementById("upload-file-input")?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={cx(
                "mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
                dragActive
                  ? "border-indigo-500 bg-indigo-500/5"
                  : file
                    ? "border-emerald-400 bg-emerald-500/5"
                    : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50 dark:border-slate-600 dark:hover:border-indigo-500 dark:hover:bg-slate-800/50",
              )}
            >
              {file ? (
                <>
                  <CheckCircle2 className="size-10 text-emerald-500" aria-hidden="true" />
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                    <FileText className="size-4" aria-hidden="true" />
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatFileSize(file.size)} Â· Click to replace
                  </p>
                </>
              ) : (
                <>
                  <CloudUpload className="size-10 text-slate-400" aria-hidden="true" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Drag &amp; drop your PDF here
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">or click to browse files</p>
                </>
              )}
              <input
                id="upload-file-input"
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) acceptFile(f);
                }}
              />
            </div>
            {!file && errors.description === "__nofile" && null}
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Publish</h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              The resource will appear in the library immediately after upload.
            </p>
            <Button type="submit" className="mt-4 w-full" size="lg" loading={submitting}>
              {submitting ? "Uploading..." : "Upload resource"}
            </Button>
            <p className="mt-3 text-center text-xs text-slate-400">
              <Badge>MOCK</Badge> Phase 5 will store files for real.
            </p>
          </Card>
        </div>
      </form>
    </div>
  );
}
