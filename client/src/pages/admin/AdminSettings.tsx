import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  AlertCircle,
  Trash2,
  RotateCcw,
  Database,
  Pencil,
  LogOut,
} from "lucide-react";
import { PageHeader, Card } from "../../components/common/PageHeader";
import { Badge } from "../../components/common/Badge";
import { Button } from "../../components/common/Button";
import { Modal } from "../../components/common/Modal";
import { Input, Select } from "../../components/common/Field";
import { Toggle } from "../../components/common/Toggle";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { adminList } from "../../lib/adminApi";
import { useApiQuery } from "../../hooks/useApiQuery";
import { useToast } from "../../state/ToastProvider";
import { useUser } from "../../state/UserProvider";
import type { NoticeType, NoticePriority, Resource, Notice } from "../../types";

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

/**
 * AdminSettings stays local-only by design (Phase 12): these are browser
 * preferences for confirmations/defaults, not server data. No API calls are
 * made for the toggles. Counts below come from the real Admin API.
 */
const SETTINGS_KEY = "meronote.admin.settings.v1";

interface LocalSettings {
  contentDefaults: { defaultResourceStatus: "draft" | "published" | "hidden"; requireDescription: boolean; requireSemester: boolean; requireSubject: boolean; requirePdf: boolean; confirmDelete: boolean };
  notices: { defaultNoticeType: NoticeType; defaultPriority: NoticePriority; autoExpireNotices: boolean; showOnDashboard: boolean };
  draftTrash: { saveAsDraftByDefault: boolean; moveDeletedToTrash: boolean; confirmDeleteForever: boolean };
}

const DEFAULT_SETTINGS: LocalSettings = {
  contentDefaults: { defaultResourceStatus: "draft", requireDescription: true, requireSemester: true, requireSubject: true, requirePdf: true, confirmDelete: true },
  notices: { defaultNoticeType: "announcement", defaultPriority: "normal", autoExpireNotices: true, showOnDashboard: true },
  draftTrash: { saveAsDraftByDefault: true, moveDeletedToTrash: true, confirmDeleteForever: true },
};

function loadSettings(): LocalSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<LocalSettings>;
    return {
      contentDefaults: { ...DEFAULT_SETTINGS.contentDefaults, ...(parsed.contentDefaults ?? {}) },
      notices: { ...DEFAULT_SETTINGS.notices, ...(parsed.notices ?? {}) },
      draftTrash: { ...DEFAULT_SETTINGS.draftTrash, ...(parsed.draftTrash ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

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
  const { toast } = useToast();
  const { name, email, role, setName, logout } = useUser();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<LocalSettings>(loadSettings);
  const [pendingReset, setPendingReset] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Keep the draft in sync with the database-backed name while the modal
  // is closed (auth resolves async; avoids editing a stale placeholder).
  useEffect(() => {
    if (!editOpen) setDraftName(name);
  }, [name, editOpen]);

  const countsQuery = useApiQuery("admin-settings-counts", async (signal) => {
    const [resources, notices] = await Promise.all([
      adminList<Resource>("resources", { limit: 1 }, signal).catch(() => ({ total: 0 })),
      adminList<Notice>("notices", { limit: 1 }, signal).catch(() => ({ total: 0 })),
    ]);
    return { resources: resources.total, notices: notices.total };
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* private mode — keep in-memory */
    }
  }, [settings]);

  const update = (section: keyof LocalSettings, patch: Record<string, unknown>) => {
    setSettings((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
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

  const saveEdit = async () => {
    if (saving) return;
    const trimmed = draftName.trim();
    if (!trimmed) {
      setNameError("Name cannot be empty.");
      return;
    }
    if (trimmed.length > 80) {
      setNameError("Name must be at most 80 characters.");
      return;
    }
    if (trimmed === name) {
      setEditOpen(false);
      return;
    }
    setSaving(true);
    try {
      await setName(trimmed);
      setEditOpen(false);
      toast("Profile updated");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update profile.", "error");
    } finally {
      setSaving(false);
    }
  };

  /** Same logout entry as Student Settings: ends the session, providers reset. */
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      toast("Logged out");
      navigate("/login");
    } catch {
      toast("Could not log out. Please try again.", "error");
    } finally {
      setLoggingOut(false);
    }
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
          <div className="flex flex-row items-center gap-4 sm:gap-6">
            <span
              aria-hidden="true"
              className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground shadow-card sm:size-24 sm:text-3xl"
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1 text-left">
              <div className="flex flex-wrap items-center justify-start gap-2">
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
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={openEdit}>
                  <Pencil className="size-3.5" aria-hidden="true" />
                  Edit Profile
                </Button>
                <Button variant="danger" size="sm" onClick={handleLogout} loading={loggingOut}>
                  <LogOut className="size-3.5" aria-hidden="true" />
                  Log out
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
              Live database counts. Preferences above stay in this browser only.
            </p>
          </div>
          <Card className="p-5 sm:p-6">
            <div className="divide-y divide-border">
              <DataRow label="Resources" value={countsQuery.data?.resources ?? "—"} />
              <DataRow label="Notices" value={countsQuery.data?.notices ?? "—"} />
            </div>
            <p className="mt-4 text-xs font-medium text-muted-foreground">
              Content lives in MongoDB via the Admin API. Reset below clears only
              this browser's local admin preferences.
            </p>
            <Button variant="danger" className="mt-4 w-full" onClick={() => setPendingReset(true)}>
              <RotateCcw className="size-4" aria-hidden="true" /> Reset local preferences
            </Button>
            <p className="mt-2 text-center text-xs font-medium text-muted-foreground/70">
              Restores default toggles in this browser; server content is untouched.
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
            <Button onClick={() => void saveEdit()} loading={saving}>Save Changes</Button>
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
        title="Reset local preferences"
        message="Browser-only admin preferences will return to defaults. Server content is untouched."
        confirmLabel="Reset"
        danger
        onCancel={() => setPendingReset(false)}
        onConfirm={() => {
          try {
            window.localStorage.removeItem(SETTINGS_KEY);
          } catch {
            /* ignore */
          }
          setSettings(DEFAULT_SETTINGS);
          toast("Local preferences reset");
          setPendingReset(false);
        }}
      />
    </div>
  );
}
