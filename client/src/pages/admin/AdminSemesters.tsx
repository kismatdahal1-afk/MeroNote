import { useState } from "react";
import {
  Award, BookOpen, CalendarDays, ChevronRight, FileText, GraduationCap, Pencil, Plus, Trash2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader, Card, StatCard } from "../../components/common/PageHeader";
import { Input, Select, Textarea } from "../../components/common/Field";
import { Button } from "../../components/common/Button";
import { IconButton } from "../../components/common/IconButton";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { useCms } from "../../state/CmsProvider";
import {
  createSubject, updateSubject,
  deleteEntity, getSettings,
} from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import { cx } from "../../lib/utils";
import { RESOURCE_TYPE_CONFIG, resourceTypeLabel } from "../../lib/resourceType";
import type { Resource, Subject, PublishStatus } from "../../types";
import { ResourceEditorModal } from "../../components/admin/ResourceEditorModal";

interface SubjectFormState {
  name: string;
  code: string;
  description: string;
  category: "core" | "elective" | "practical";
  credits: number;
  status: PublishStatus;
  semesterId: string;
}

function emptySubjectForm(semesterId: string): SubjectFormState {
  return { name: "", code: "", description: "", category: "core", credits: 3, status: "published", semesterId };
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;
function toRoman(n: number): string {
  return ROMAN[n] ?? String(n);
}

export default function AdminSemesters() {
  const db = useCms();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [resourceFormOpen, setResourceFormOpen] = useState(false);
  const [resourceDefaultSemester, setResourceDefaultSemester] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string; type: "subject" } | null>(null);

  const [subjectForm, setSubjectForm] = useState<SubjectFormState>(emptySubjectForm(""));

  const semesters = db.semesters.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order);
  const allSubjects = db.subjects.filter((s) => !s.deletedAt);

  const resourceCountForSubject = (subId: string) => db.resources.filter((r) => !r.deletedAt && r.subjectId === subId).length;

  const toggleExpand = (subjectId: string) => {
    setExpandedSubjectId((prev) => (prev === subjectId ? null : subjectId));
  };

  const openAddSubject = (semesterId: string) => {
    setEditingSubject(null);
    setSubjectForm(emptySubjectForm(semesterId));
    setSubjectFormOpen(true);
  };

  const openEditSubject = (s: Subject) => {
    setEditingSubject(s);
    setSubjectForm({ name: s.name, code: s.code, description: s.description, category: s.category, credits: s.credits, status: s.status, semesterId: s.semesterId });
    setSubjectFormOpen(true);
  };

  const handleSubjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.semesterId || !subjectForm.name.trim() || !subjectForm.code.trim() || !subjectForm.credits || Number(subjectForm.credits) < 1) return;

    const draft = {
      semesterId: subjectForm.semesterId,
      name: subjectForm.name.trim(),
      code: subjectForm.code.trim().toUpperCase(),
      description: subjectForm.description.trim(),
      category: subjectForm.category,
      credits: Number(subjectForm.credits),
      status: subjectForm.status,
    };

    if (editingSubject) {
      updateSubject(editingSubject.id, draft);
      toast("Subject updated");
    } else {
      createSubject(draft);
      toast("Subject created");
    }
    setSubjectFormOpen(false);
    setEditingSubject(null);
  };

  const deleteSubject = (s: Subject) => {
    if (!getSettings().contentDefaults.confirmDelete) {
      deleteEntity("subject", s.id);
      toast(
        getSettings().draftTrash.moveDeletedToTrash
          ? `"${s.name}" moved to trash`
          : `"${s.name}" permanently deleted`,
      );
      return;
    }
    setPendingDelete({ id: s.id, name: s.name, type: "subject" });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteEntity("subject", pendingDelete.id);
    toast(
      getSettings().draftTrash.moveDeletedToTrash
        ? `"${pendingDelete.name}" moved to trash`
        : `"${pendingDelete.name}" permanently deleted`,
    );
    setPendingDelete(null);
  };

  const openAddResource = (semesterId: string) => {
    setResourceDefaultSemester(semesterId);
    setResourceFormOpen(true);
  };

  const handleResourceClick = (resource: Resource) => {
    navigate(`/admin/resources/${resource.id}`, { state: { via: "semesters" } });
  };

  const sortedSemesters = [...semesters].sort((a, b) => a.order - b.order);

  // Overview stats — compact, not oversized
  const totalSemesters = semesters.length;
  const totalSubjects = allSubjects.length;
  const totalCredits = semesters.reduce((s, sem) => s + sem.credits, 0);
  const currentSemester = semesters.find((s) => s.enrollment === "active") ?? semesters.find((s) => s.order === 4) ?? semesters[0];

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Link to="/admin" className="rounded px-1 py-0.5 hover:text-primary">Admin</Link>
        <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
        <span aria-current="page" className="font-semibold text-foreground">Semesters</span>
      </nav>

      <PageHeader
        title="Semesters"
        subtitle="Manage the academic structure, subjects, topics and resources."
      />

      {/* Overview — 4 small separate box-style cards in one row, same size as dashboard, equal and responsive */}
      <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Semesters"
          value={totalSemesters}
          hint="BSc CSIT program"
          icon={<GraduationCap className="size-5" aria-hidden="true" />}
        />
        <StatCard
          label="Total Subjects"
          value={totalSubjects}
          hint="Across curriculum"
          icon={<BookOpen className="size-5" aria-hidden="true" />}
        />
        <StatCard
          label="Total Credits"
          value={totalCredits}
          hint="Total credit hours"
          icon={<Award className="size-5" aria-hidden="true" />}
        />
        <StatCard
          label="Current Semester"
          value={currentSemester ? `Semester ${toRoman(currentSemester.number)}` : "—"}
          hint={currentSemester ? (currentSemester.enrollment === "active" ? "Ongoing • Active now" : currentSemester.enrollment) : "—"}
          icon={<CalendarDays className="size-5" aria-hidden="true" />}
        />
      </div>

      {sortedSemesters.map((semester) => {
        const semSubjects = allSubjects.filter((s) => s.semesterId === semester.id).sort((a, b) => a.name.localeCompare(b.name));

        return (
          <section key={semester.id} className="semester-section space-y-3">
            {/* Semester heading — larger text, icon-only (no background card), actions on right */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Semester {toRoman(semester.number)}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => openAddSubject(semester.id)}>
                  <Plus className="size-3.5" aria-hidden="true" /> Add Subject
                </Button>
                <Button variant="secondary" size="sm" onClick={() => openAddResource(semester.id)}>
                  <Plus className="size-3.5" aria-hidden="true" /> Add Resource
                </Button>
              </div>
            </div>

            {/* Subject cards grid: 2-col desktop / 1-col mobile — items-start prevents sibling card stretching */}
            {semSubjects.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-start">
                {semSubjects.map((subject) => {
                  const isExpanded = expandedSubjectId === subject.id;

                  return (
                    <Card
                      key={subject.id}
                      className={cx(
                        "self-start overflow-hidden border transition-[border-color,box-shadow] duration-200",
                        isExpanded && "border-primary/40 shadow-card-hover",
                      )}
                    >
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => toggleExpand(subject.id)}
                        className="flex w-full cursor-pointer flex-col items-start gap-3 p-4 text-left transition-colors hover:bg-surface-hover"
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-primary-muted px-2 py-0.5 text-xs font-bold text-primary">{subject.code}</span>
                            <StatusBadge status={subject.status} />
                          </div>
                          <div className="flex items-center gap-1">
                            <IconButton icon={Pencil} label={`Edit ${subject.name}`} size="sm" onClick={(e) => { e.stopPropagation(); openEditSubject(subject); }} />
                            <IconButton icon={Trash2} label={`Delete ${subject.name}`} size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); deleteSubject(subject); }} />
                          </div>
                        </div>
                        <h3 className="text-base font-bold leading-tight text-foreground">{subject.name}</h3>
                        <p className="line-clamp-2 min-h-[2.2rem] text-xs leading-relaxed text-muted-foreground">
                          {subject.description || `${subject.category} • ${subject.credits} credits`}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{resourceCountForSubject(subject.id)} {resourceCountForSubject(subject.id) === 1 ? "resource" : "resources"}</span>
                          <span className="size-1 rounded-full bg-border-strong" aria-hidden="true" />
                          <span>{subject.credits} cr</span>
                        </div>
                      </button>

                      {/* Expanded — buttery smooth height + opacity + translate */}
                      <div
                        className={cx(
                          "grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[grid-template-rows,opacity]",
                          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                        )}
                      >
                        <div
                          className={cx(
                            "overflow-hidden transition-[opacity,transform] duration-400 ease-out will-change-[opacity,transform]",
                            isExpanded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
                          )}
                        >
                          <div className="border-t border-border bg-surface-muted/60 p-4">
                            {(() => {
                              const subjectResources = db.resources
                                .filter((r) => !r.deletedAt && r.subjectId === subject.id)
                                .sort((a, b) => +new Date(a.uploadedAt) - +new Date(b.uploadedAt));
                              const mainBook = subjectResources.find((r) => r.type === "book");
                              const childResources = subjectResources.filter((r) => r.id !== mainBook?.id);
                              // Group child resources by actual Resource Type (or custom name) — only types that exist
                              const grouped = new Map<string, { label: string; icon: any; resources: typeof childResources }>();
                              for (const r of childResources) {
                                const isCustom = r.type === "custom";
                                const label = isCustom ? (r.customType?.trim() || "Custom") : resourceTypeLabel(r.type as any);
                                const key = isCustom ? `custom:${label}` : r.type;
                                const cfg = (RESOURCE_TYPE_CONFIG as any)[r.type] ?? RESOURCE_TYPE_CONFIG.custom;
                                if (!grouped.has(key)) grouped.set(key, { label, icon: cfg.icon, resources: [] });
                                grouped.get(key)!.resources.push(r);
                              }
                              const hasAny = mainBook || grouped.size > 0;
                              if (!hasAny) {
                                return (
                                  <p className="rounded-lg border border-dashed border-border-strong bg-surface px-3 py-2.5 text-xs text-muted-foreground">No resources yet for this subject — add the first resource.</p>
                                );
                              }
                              return (
                                <div className="space-y-4">
                                  {mainBook ? (
                                    <button
                                      type="button"
                                      onClick={() => handleResourceClick(mainBook)}
                                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left shadow-sm transition-colors hover:border-primary/30 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                    >
                                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-muted text-primary">
                                        <BookOpen className="size-4" aria-hidden="true" />
                                      </span>
                                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{mainBook.title}</span>
                                      <span className="hidden shrink-0 rounded-full bg-primary-muted px-2 py-0.5 text-xs font-semibold text-primary sm:inline-flex">Book</span>
                                    </button>
                                  ) : null}

                                  <div className="space-y-4">
                                    {[...grouped.entries()].map(([key, group]) => {
                                      const Icon = group.icon;
                                      return (
                                        <div key={key} className="space-y-2">
                                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                            <Icon className="size-3.5" aria-hidden="true" />
                                            {group.label}
                                          </p>
                                          <ul className="space-y-2">
                                            {group.resources.map((res) => (
                                              <li key={res.id}>
                                                <button
                                                  type="button"
                                                  onClick={() => handleResourceClick(res)}
                                                  className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface p-2.5 text-left transition-colors hover:border-primary/30 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                                >
                                                  <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{res.title}</span>
                                                </button>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface p-6 text-center text-muted-foreground">
                <p className="text-base font-medium">No subjects yet for {semester.name}</p>
                <p className="mt-2 text-sm">Click "Add Subject" to get started.</p>
              </div>
            )}
          </section>
        );
      })}

      {/* Subject modal */}
      <Modal
        open={subjectFormOpen}
        onClose={() => { setSubjectFormOpen(false); setEditingSubject(null); }}
        title={editingSubject ? "Edit Subject" : "Add Subject"}
      >
        <form onSubmit={handleSubjectSubmit} noValidate className="mt-4 space-y-4">
          <Input id="sub-name" label="Subject Name" value={subjectForm.name} onChange={(e) => setSubjectForm((p) => ({ ...p, name: e.target.value }))} error={!subjectForm.name.trim() ? "Subject name is required" : undefined} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="sub-code" label="Code" value={subjectForm.code} onChange={(e) => setSubjectForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} error={!subjectForm.code.trim() ? "Code is required" : undefined} required />
            <Input id="sub-credits" label="Credits" type="number" min={1} value={subjectForm.credits} onChange={(e) => setSubjectForm((p) => ({ ...p, credits: Number(e.target.value) || 0 }))} error={!subjectForm.credits || subjectForm.credits < 1 ? "Enter credits ≥ 1" : undefined} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select id="sub-category" label="Category" value={subjectForm.category} onChange={(e) => setSubjectForm((p) => ({ ...p, category: e.target.value as "core" | "elective" | "practical" }))} options={[{ value: "core", label: "Core" }, { value: "elective", label: "Elective" }, { value: "practical", label: "Practical" }]} />
            <Select id="sub-status" label="Status" value={subjectForm.status} onChange={(e) => setSubjectForm((p) => ({ ...p, status: e.target.value as PublishStatus }))} options={[{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }, { value: "hidden", label: "Hidden" }]} />
          </div>
          <Select
            id="sub-semester"
            label="Semester"
            value={subjectForm.semesterId}
            onChange={(e) => setSubjectForm((p) => ({ ...p, semesterId: e.target.value }))}
            options={[
              { value: "", label: "Select semester..." },
              ...semesters.map((s) => ({ value: s.id, label: s.name })),
            ]}
            error={!subjectForm.semesterId ? "Semester is required" : undefined}
            required
          />
          <Textarea id="sub-desc" label="Description" rows={3} value={subjectForm.description} onChange={(e) => setSubjectForm((p) => ({ ...p, description: e.target.value }))} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => { setSubjectFormOpen(false); setEditingSubject(null); }}>Cancel</Button>
            <Button type="submit">{editingSubject ? "Save changes" : "Create subject"}</Button>
          </div>
        </form>
      </Modal>

      {/* Resource modal */}
      <ResourceEditorModal
        open={resourceFormOpen}
        onClose={() => setResourceFormOpen(false)}
        defaultSemesterId={resourceDefaultSemester || undefined}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.type ?? ""}`}
        message={`"${pendingDelete?.name}" will move to the trash.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
