import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sun, Moon, Monitor, User, Palette, BookOpen, HardDrive, Info, ShieldCheck,
} from "lucide-react";
import { PageHeader, Card } from "../components/common/PageHeader";
import { Badge } from "../components/common/Badge";
import { useTheme } from "../state/ThemeProvider";
import { useLibrary } from "../state/LibraryProvider";
import { mockUser } from "../data/mock";
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

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { totalDownloadSize, downloads } = useLibrary();
  const completed = downloads.filter((d) => d.status === "completed").length;

  const themeOptions: { value: "light" | "dark" | "system"; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div>
      <PageHeader title="Settings" subtitle="Preferences for your Mero Note experience." />

      <div className="mx-auto max-w-3xl space-y-6">
        {/* Appearance */}
        <Card className="p-6">
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

        {/* Account */}
        <Card className="p-6">
          <SectionTitle icon={User}>Account</SectionTitle>
          <div className="mt-4 flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              AS
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">{mockUser.name}</p>
              <p className="truncate text-sm font-medium text-muted-foreground">{mockUser.email}</p>
            </div>
            <Badge tone={mockUser.role === "ADMIN" ? "warning" : "accent"}>{mockUser.role}</Badge>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground/70">
            Profile management arrives with authentication in Phase 4.
          </p>
        </Card>

        {/* Reading preferences */}
        <Card className="p-6">
          <SectionTitle icon={BookOpen}>Reading Preferences</SectionTitle>
          <div className="mt-4 space-y-4">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Continue where you left off</span>
                <span className="block text-xs font-medium text-muted-foreground">
                  Reopen resources at your last-read page.
                </span>
              </span>
              <input
                type="checkbox"
                defaultChecked
                className="size-5 shrink-0 rounded border-border-strong text-primary focus:ring-primary/25"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Track reading progress</span>
                <span className="block text-xs font-medium text-muted-foreground">
                  Keep your last page and completion percentage up to date.
                </span>
              </span>
              <input
                type="checkbox"
                defaultChecked
                className="size-5 shrink-0 rounded border-border-strong text-primary focus:ring-primary/25"
              />
            </label>
          </div>
        </Card>

        {/* Storage */}
        <Card className="p-6">
          <SectionTitle icon={HardDrive}>Storage</SectionTitle>
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
              <span className="font-bold text-foreground">Total used</span>
              <span className="font-bold text-foreground">{formatFileSize(totalDownloadSize)}</span>
            </div>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground/70">
            Full storage management (clear cache, manage downloads) arrives in Phase 9.
          </p>
          <Link
            to="/downloads"
            className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Manage downloads →
          </Link>
        </Card>

        {/* About */}
        <Card className="p-6">
          <SectionTitle icon={Info}>About</SectionTitle>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-medium text-muted-foreground">
            <Badge>Mero Note v0.2.5</Badge>
            <ApiHealth />
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-muted-foreground/60" aria-hidden="true" />
              Phase 2.5 prototype — mock data
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
