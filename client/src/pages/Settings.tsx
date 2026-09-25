import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sun, Moon, Monitor, Palette, BookOpen, HardDrive, Info, ShieldCheck,
  Bell, Pencil, Trash2, FolderOpen, ChevronRight, Check, LogOut,
} from "lucide-react";
import { PageHeader, Card } from "../components/common/PageHeader";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Modal } from "../components/common/Modal";
import { Input } from "../components/common/Field";
import { useTheme } from "../state/ThemeProvider";
import { useUser } from "../state/UserProvider";
import { useLibrary } from "../state/LibraryProvider";
import { useToast } from "../state/ToastProvider";
import { formatFileSize, cx } from "../lib/utils";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
type HealthState = "checking" | "ok" | "down";

function ApiHealth() {
  const [health, setHealth] = useState<HealthState>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/health`)
      .then((res): HealthState => (res.ok ? "ok" : "down"))
      .catch((): HealthState => "down")
      .then((state) => {
        if (!cancelled) setHealth(state);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Badge tone={health === "ok" ? "success" : health === "down" ? "error" : "accent"}>
      {health === "ok" ? "API connected" : health === "down" ? "API offline" : "Checking API..."}
    </Badge>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Sun; children: string }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
      <Icon className="size-4.5 text-primary" aria-hidden="true" />
      {children}
    </h2>
  );
}

interface ToggleRowProps {
  title: string;
  description: string;
  defaultChecked?: boolean;
}

/** Accessible toggle switch row. */
function ToggleRow({ title, description, defaultChecked = true }: ToggleRowProps) {
  const [on, setOn] = useState(defaultChecked);
  const toggleId = `toggle-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <label htmlFor={toggleId} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs font-medium text-muted-foreground">{description}</span>
      </label>
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={() => setOn((v) => !v)}
        className={cx(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          on ? "bg-primary" : "bg-border-strong",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "absolute top-0.5 left-0.5 flex size-5 items-center justify-center rounded-full bg-surface text-primary shadow-sm transition-transform",
            on ? "translate-x-5" : "translate-x-0",
          )}
        >
          {on && <Check className="size-3 text-primary" aria-hidden="true" />}
        </span>
      </button>
    </div>
  );
}

/** Compact key–value row used inside Data & Privacy / About. */
function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { name, email, role, setName, logout } = useUser();
  const { totalDownloadSize, downloads } = useLibrary();
  const { toast } = useToast();
  const navigate = useNavigate();
  const completed = downloads.filter((d) => d.status === "completed").length;

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

  /** Phase 17 logout entry: ends the session, providers reset to guest state. */
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

  const themeOptions: { value: "light" | "dark" | "system"; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <div>
      <PageHeader title="Settings" subtitle="Preferences for your Mero Note experience." />

      <div className="mx-auto max-w-3xl space-y-4">
        {/* Profile — top, prominent */}
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
              <p className="mt-1 truncate text-sm font-medium text-muted-foreground">
                {email}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground/70">
                CSIT Study Library member
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

        {/* Appearance */}
        <Card className="p-5 sm:p-6">
          <SectionTitle icon={Palette}>Appearance</SectionTitle>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Choose how Mero Note looks. System follows your device preference.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Theme selection">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={theme === value}
                className={cx(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-semibold transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  theme === value
                    ? "border-primary bg-primary-muted text-primary"
                    : "border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </Card>

        {/* Reading preferences */}
        <Card className="p-5 sm:p-6">
          <SectionTitle icon={BookOpen}>Reading Preferences</SectionTitle>
          <div className="mt-4 space-y-3 divide-y divide-border">
            <ToggleRow
              title="Continue where you left off"
              description="Reopen resources at your last-read page."
            />
            <div className="pt-3">
              <ToggleRow
                title="Track reading progress"
                description="Keep your last page and completion percentage up to date."
              />
            </div>
            <div className="pt-3">
              <ToggleRow
                title="Remember last opened resource"
                description="Show your recently opened resources on the dashboard."
              />
            </div>
          </div>
        </Card>

        {/* Storage & Downloads */}
        <Card className="p-5 sm:p-6">
          <SectionTitle icon={HardDrive}>Storage &amp; Downloads</SectionTitle>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground">Downloaded files</span>
              <span className="font-bold text-foreground">
                {completed} · {formatFileSize(totalDownloadSize)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground">Temporary cache</span>
              <span className="font-bold text-foreground">0 B</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="font-bold text-foreground">Total storage</span>
              <span className="font-bold text-foreground">{formatFileSize(totalDownloadSize)}</span>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <Link
              to="/downloads"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <FolderOpen className="size-4" aria-hidden="true" />
              Manage Downloads
            </Link>
            <Button
              variant="outline"
              onClick={() => toast("Clear cache — coming soon", "info")}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Clear Temporary Cache
            </Button>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground/70">
            Clearing cache never removes your explicit downloads.
          </p>
        </Card>

        {/* Notifications */}
        <Card className="p-5 sm:p-6">
          <SectionTitle icon={Bell}>Notifications</SectionTitle>
          <div className="mt-4 space-y-3 divide-y divide-border">
            <ToggleRow
              title="Study reminders"
              description="Gentle nudges to keep your reading streak alive."
            />
            <div className="pt-3">
              <ToggleRow
                title="New resources"
                description="Get notified when fresh notes or past papers arrive."
                defaultChecked={false}
              />
            </div>
            <div className="pt-3">
              <ToggleRow
                title="System updates"
                description="Occasional product and maintenance announcements."
                defaultChecked={false}
              />
            </div>
          </div>
        </Card>

        {/* About */}
        <Card className="p-5 sm:p-6">
          <SectionTitle icon={Info}>About</SectionTitle>
          <div className="mt-4 divide-y divide-border">
            <DataRow label="Version" value="Mero Note v0.2.5" />
            <DataRow
              label="API status"
              value={<ApiHealth />}
            />
            <Link
              to="/help"
              className="flex items-center justify-between gap-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <span>Help &amp; Support</span>
              <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            Connected library with offline-ready downloads
          </p>
        </Card>
      </div>

      {/* Edit profile — persists display name to the users record */}
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
    </div>
  );
}
