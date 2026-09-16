import { useState } from "react";
import {
  FileText,
  AlertCircle,
  Trash2,
  RotateCcw,
  Database,
  Pencil,
} from "lucide-react";
import { PageHeader, Card } from "../../components/common/PageHeader";
import { Badge } from "../../components/common/Badge";
import { Button } from "../../components/common/Button";
import { Modal } from "../../components/common/Modal";
import { Input, Select } from "../../components/common/Field";
import { Toggle } from "../../components/common/Toggle";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { useCms } from "../../state/CmsProvider";
import {
  resetDb,
  getSettings,
  updateContentDefaults,
  updateNotices,
  updateDraftTrash,
} from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import { useUser } from "../../state/UserProvider";
import type { NoticeType, NoticePriority } from "../../types";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "hidden", label: "Hidden" },
];

const NOTICE_TYPE_OPTIONS: { value: NoticeType; label: string }[] = [
  { value: "exam", label: "Exam" },
  { value: "deadline", label: "Deadline" },
  { value: "assignment", label: "Assignment" },
  { value: "event", label: "Event" },
  { value: "important", label: "Important" },
  { value: "general", label: "General" },
];

const PRIORITY_OPTIONS: { value: NoticePriority; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

/* ─── Shared section title — identical to Student Settings ─── */

function SectionTitle({ icon: Icon, children }: { icon: typeof FileText; children: string }) {
  return (
    <h2 className="flex items-center gap-2 text-[17px] font-bold leading-6 text-foreground sm:text-[18px]">
      <Icon className="size-5 text-primary" aria-hidden="true" />
      {children}
    </h2>
  );
}

/* ─── Admin toggle row — same visual rhythm as Student ToggleRow ─── */

function AdminToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs font-medium text-muted-foreground">{description}</span>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

function AdminDropdownRow({
  title,
  description,
  options,
  value,
  onChange,
}: {
  title: string;
  description: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `setting-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex flex-col gap-2.5 py-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-5 text-foreground">{title}</span>
        <span className="block text-xs font-medium leading-4 text-muted-foreground">
          {description}
        </span>
      </div>
      {/* Same hidden menu as Resources page — uses Field Select identical to Resources */}
      <Select
        id={id}
        label=""
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={options}
        className="w-full sm:w-48"
        aria-label={title}
      />
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

export default function AdminSettings() {
  const db = useCms();
  const { toast } = useToast();
  const { name, email, role, setName } = useUser();
  const [settings, setSettings] = useState(getSettings);
  const [pendingReset, setPendingReset] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [nameError, setNameError] = useState("");

  const update = (section: keyof typeof settings, patch: object) => {
    const updaters = {
      contentDefaults: updateContentDefaults,
      notices: updateNotices,
      draftTrash: updateDraftTrash,
    };
    updaters[section](patch);
    setSettings(getSettings());
    toast("Setting updated");
  };

  const s = settings;

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  const openEdit = () => {
    setDraftName(name);
    setNameError("");
    setEditOpen(true);
  };

  const saveEdit = () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setNameError("Name cannot be empty.");
      return;
    }
    if (trimmed === name) {
      setEditOpen(false);
      return;
    }
    setName(trimmed);
    setEditOpen(false);
    toast("Profile updated");
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage content, notice, draft and deletion preferences."
      />

      <div className="mx-auto max-w-3xl space-y-4">
        {/* Profile — identical structure to Student Settings, admin identity */}
        <Card className="bg-hero-gradient p-6 sm:p-8">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
            <span
              aria-hidden="true"
              className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground shadow-card sm:size-24 sm:text-3xl"
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {name}
                </h1>
                <Badge tone={role === "ADMIN" ? "warning" : "primary"}>
                  {role === "ADMIN" ? "Admin" : "Student"}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm font-medium text-muted-foreground">{email}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground/70">
                Admin · Content management
              </p>
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={openEdit}>
                  <Pencil className="size-3.5" aria-hidden="true" />
                  Edit Profile
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Content Defaults — heading outside card, left top */}
        <section>
          <div className="mb-3 px-1">
            <SectionTitle icon={FileText}>Content Defaults</SectionTitle>
            <p className="mt-1 ml-[28px] text-sm font-medium text-muted-foreground">
              New resource behavior and publishing requirements.
            </p>
          </div>
          <Card className="p-5 sm:p-6">
            <div className="space-y-3 divide-y divide-border">
              <AdminDropdownRow
                title="Default Resource Status"
                description="Status applied to newly created resources"
                options={STATUS_OPTIONS}
                value={s.contentDefaults.defaultResourceStatus}
                onChange={(v) =>
                  update("contentDefaults", { defaultResourceStatus: v as "draft" | "published" | "hidden" })
                }
              />
              <div className="pt-3">
                <AdminToggleRow
                  title="Require Description"
                  description="Description required before publishing"
                  checked={s.contentDefaults.requireDescription}
                  onChange={(v) => update("contentDefaults", { requireDescription: v })}
                />
              </div>
              <div className="pt-3">
                <AdminToggleRow
                  title="Require Semester"
                  description="Semester must be selected before publishing"
                  checked={s.contentDefaults.requireSemester}
                  onChange={(v) => update("contentDefaults", { requireSemester: v })}
                />
              </div>
              <div className="pt-3">
                <AdminToggleRow
                  title="Require Subject"
                  description="Subject must be selected before publishing"
                  checked={s.contentDefaults.requireSubject}
                  onChange={(v) => update("contentDefaults", { requireSubject: v })}
                />
              </div>
              <div className="pt-3">
                <AdminToggleRow
                  title="Require PDF / File"
                  description="A file must be attached before publishing"
                  checked={s.contentDefaults.requirePdf}
                  onChange={(v) => update("contentDefaults", { requirePdf: v })}
                />
              </div>
              <div className="pt-3">
                <AdminToggleRow
                  title="Confirm Before Deleting"
                  description="Ask for confirmation before removing content"
                  checked={s.contentDefaults.confirmDelete}
                  onChange={(v) => update("contentDefaults", { confirmDelete: v })}
                />
              </div>
            </div>
          </Card>
        </section>

        {/* Notice Settings — heading outside card */}
        <section>
          <div className="mb-3 px-1">
            <SectionTitle icon={AlertCircle}>Notice Settings</SectionTitle>
            <p className="mt-1 ml-[28px] text-sm font-medium text-muted-foreground">
              Default notice type, priority, and expiry behavior.
            </p>
          </div>
          <Card className="p-5 sm:p-6">
            <div className="space-y-3 divide-y divide-border">
              <AdminDropdownRow
                title="Default Notice Type"
                description="Type assigned to new notices"
                options={NOTICE_TYPE_OPTIONS}
                value={s.notices.defaultNoticeType}
                onChange={(v) => update("notices", { defaultNoticeType: v as NoticeType })}
              />
              <div className="pt-3">
                <AdminDropdownRow
                  title="Default Priority"
                  description="Priority assigned to new notices"
                  options={PRIORITY_OPTIONS}
                  value={s.notices.defaultPriority}
                  onChange={(v) => update("notices", { defaultPriority: v as NoticePriority })}
                />
              </div>
              <div className="pt-3">
                <AdminToggleRow
                  title="Auto-Expire Notices"
                  description="Notices expire automatically after their date"
                  checked={s.notices.autoExpireNotices}
                  onChange={(v) => update("notices", { autoExpireNotices: v })}
                />
              </div>
              <div className="pt-3">
                <AdminToggleRow
                  title="Show on Student Dashboard"
                  description="Published notices appear on the student dashboard"
                  checked={s.notices.showOnDashboard}
                  onChange={(v) => update("notices", { showOnDashboard: v })}
                />
              </div>
            </div>
          </Card>
        </section>

        {/* Draft & Trash — heading outside card */}
        <section>
          <div className="mb-3 px-1">
            <SectionTitle icon={Trash2}>Draft & Trash</SectionTitle>
            <p className="mt-1 ml-[28px] text-sm font-medium text-muted-foreground">
              How drafts are saved and deleted content is handled.
            </p>
          </div>
          <Card className="p-5 sm:p-6">
            <div className="space-y-3 divide-y divide-border">
              <AdminToggleRow
                title="Save as Draft by Default"
                description="New content is saved as draft initially"
                checked={s.draftTrash.saveAsDraftByDefault}
                onChange={(v) => update("draftTrash", { saveAsDraftByDefault: v })}
              />
              <div className="pt-3">
                <AdminToggleRow
                  title="Move Deleted to Trash"
                  description="Deleted content goes to trash instead of being removed permanently"
                  checked={s.draftTrash.moveDeletedToTrash}
                  onChange={(v) => update("draftTrash", { moveDeletedToTrash: v })}
                />
              </div>
              <div className="pt-3">
                <AdminToggleRow
                  title="Confirm Delete Forever"
                  description="Ask for confirmation before permanently deleting"
                  checked={s.draftTrash.confirmDeleteForever}
                  onChange={(v) => update("draftTrash", { confirmDeleteForever: v })}
                />
              </div>
            </div>
          </Card>
        </section>

        {/* CMS Data — heading outside card */}
        <section>
          <div className="mb-3 px-1">
            <SectionTitle icon={Database}>CMS Data</SectionTitle>
            <p className="mt-1 ml-[28px] text-sm font-medium text-muted-foreground">
              Local browser storage until the real API arrives.
            </p>
          </div>
          <Card className="p-5 sm:p-6">
            <div className="divide-y divide-border">
              <DataRow label="Resources" value={db.resources.filter((r) => !r.deletedAt).length} />
              <DataRow label="Notices" value={db.notices.filter((n) => !n.deletedAt).length} />
            </div>
            <p className="mt-4 text-xs font-medium text-muted-foreground">
              Content is stored in this browser (localStorage) until the real API + database
              arrive.
            </p>
            <Button variant="danger" className="mt-4 w-full" onClick={() => setPendingReset(true)}>
              <RotateCcw className="size-4" aria-hidden="true" /> Reset CMS to seed data
            </Button>
            <p className="mt-2 text-center text-xs font-medium text-muted-foreground/70">
              Restores the original demo content and discards admin changes.
            </p>
          </Card>
        </section>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Profile"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            id="edit-name"
            label="Display name"
            value={draftName}
            error={nameError}
            onChange={(e) => {
              setDraftName(e.target.value);
              if (nameError) setNameError("");
            }}
            placeholder="Your name"
            autoFocus
          />
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Email (read-only)</p>
            <p className="rounded-lg border border-border bg-surface-muted px-3.5 py-2.5 text-sm font-medium text-muted-foreground">
              {email}
            </p>
          </div>
          <p className="text-xs font-medium text-muted-foreground/70">
            Your name appears in the header, drawer, dashboard greeting, and profile.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingReset}
        title="Reset CMS data"
        message="All admin changes will be discarded and the original demo content restored."
        confirmLabel="Reset"
        danger
        onCancel={() => setPendingReset(false)}
        onConfirm={() => {
          resetDb();
          toast("CMS data reset to seed content");
          setPendingReset(false);
        }}
      />
    </div>
  );
}
