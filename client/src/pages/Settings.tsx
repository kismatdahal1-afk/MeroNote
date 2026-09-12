import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sun, Moon, User, Palette, BookOpen, HardDrive, Info, ShieldCheck,
} from "lucide-react";
import { PageHeader, Card } from "../components/common/PageHeader";
import { Badge } from "../components/common/Badge";
import { useTheme } from "../state/ThemeProvider";
import { useLibrary } from "../state/LibraryProvider";
import { mockUser } from "../data/mock";
import { formatFileSize } from "../lib/utils";
import { cx } from "../lib/utils";

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
    <Badge tone={health === "ok" ? "emerald" : health === "down" ? "red" : "sky"}>
      {health === "ok" ? "API connected" : health === "down" ? "API offline" : "Checking API..."}
    </Badge>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Sun; children: string }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
      <Icon className="size-4.5 text-indigo-500" aria-hidden="true" />
      {children}
    </h2>
  );
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { totalDownloadSize, downloads } = useLibrary();
  const completed = downloads.filter((d) => d.status === "completed").length;

  const themeOptions: { value: "light" | "dark"; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];

  return (
    <div>
      <PageHeader title="Settings" subtitle="Preferences for your Mero Note experience." />

      <div className="mx-auto max-w-3xl space-y-6">
        {/* Appearance */}
        <Card className="p-6">
          <SectionTitle icon={Palette}>Appearance</SectionTitle>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Choose how Mero Note looks. Light for daytime, dark for low-light reading.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Theme selection">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={theme === value}
                className={cx(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
                  theme === value
                    ? "border-indigo-500 bg-indigo-500/5 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
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
            <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white">
              AS
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{mockUser.name}</p>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">{mockUser.email}</p>
            </div>
            <Badge tone={mockUser.role === "ADMIN" ? "amber" : "sky"}>{mockUser.role}</Badge>
          </div>
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            Profile management arrives with authentication in Phase 4.
          </p>
        </Card>

        {/* Reading preferences */}
        <Card className="p-6">
          <SectionTitle icon={BookOpen}>Reading Preferences</SectionTitle>
          <div className="mt-4 space-y-4">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">Continue where you left off</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Reopen resources at your last-read page.
                </span>
              </span>
              <input
                type="checkbox"
                defaultChecked
                className="size-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">Track reading progress</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Keep your last page and completion percentage up to date.
                </span>
              </span>
              <input
                type="checkbox"
                defaultChecked
                className="size-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
          </div>
        </Card>

        {/* Storage */}
        <Card className="p-6">
          <SectionTitle icon={HardDrive}>Storage</SectionTitle>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300">Downloaded files</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {completed} Â· {formatFileSize(totalDownloadSize)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300">Temporary cache</span>
              <span className="font-semibold text-slate-900 dark:text-white">0 B</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700/50">
              <span className="font-medium text-slate-700 dark:text-slate-200">Total used</span>
              <span className="font-bold text-slate-900 dark:text-white">{formatFileSize(totalDownloadSize)}</span>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            Full storage management (clear cache, manage downloads) arrives in Phase 9.
          </p>
          <Link
            to="/downloads"
            className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Manage downloads â†’
          </Link>
        </Card>

        {/* About */}
        <Card className="p-6">
          <SectionTitle icon={Info}>About</SectionTitle>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <Badge>Mero Note v0.2.0</Badge>
            <ApiHealth />
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-slate-400" aria-hidden="true" />
              Phase 2 prototype â€” mock data
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
