import { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { PageHeader, Card } from "../components/common/PageHeader";
import { EmptyState, ErrorState } from "../components/common/States";
import { SearchBar } from "../components/common/SearchBar";
import { NoticeRow } from "../components/dashboard/NoticesBoard";
import { fetchNotices } from "../lib/contentApi";
import { noticeSort, noticeWithState } from "../lib/noticeState";
import { useApiQuery } from "../hooks/useApiQuery";
import { NoticesSkeleton } from "../components/skeletons/pages";
import type { NoticeType } from "../types";
import { cx } from "../lib/utils";

/** Filter chips: notice type + all. Kept local to this page. */
const TYPE_FILTERS: { value: NoticeType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "exam", label: "Exams" },
  { value: "deadline", label: "Deadlines" },
  { value: "announcement", label: "Announcements" },
  { value: "reminder", label: "Reminders" },
  { value: "general", label: "General" },
];

export default function Notices() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<NoticeType | "all">("all");

  const { data, error, loading, retry } = useApiQuery("notices", (signal) => fetchNotices(false, signal));
  const notices = useMemo(
    () => (data?.rows ?? []).map(noticeWithState).sort(noticeSort),
    [data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notices.filter((n) => {
      if (type !== "all" && n.type !== type) return false;
      if (!q) return true;
      return (
        n.heading.toLowerCase().includes(q) ||
        n.subtext.toLowerCase().includes(q)
      );
    });
  }, [notices, query, type]);

  const counts = useMemo(() => {
    const byType: Partial<Record<NoticeType, number>> = {};
    for (const n of notices) byType[n.type] = (byType[n.type] ?? 0) + 1;
    return byType;
  }, [notices]);

  return (
    <div>
      <PageHeader
        title="Notices"
        subtitle="Exam schedules, deadlines and announcements published by your admins."
      />

      <SearchBar
        initialValue={query}
        className="mb-5 max-w-xl"
        placeholder="Search notices..."
        onSubmit={setQuery}
        onChange={setQuery}
      />

      {/* Type filter chips */}
      <div
        role="group"
        aria-label="Filter by notice type"
        className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TYPE_FILTERS.map((chip) => {
          const isActive = type === chip.value;
          const count =
            chip.value === "all"
              ? notices.length
              : counts[chip.value as NoticeType];
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => setType(chip.value)}
              className={cx(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "border border-border-strong bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              {chip.label}
              {count !== undefined && (
                <span className={cx("ml-1 font-bold", isActive ? "opacity-80" : "text-primary")}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <NoticesSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query ? "No matching notices" : "No notices yet"}
          message={
            query
              ? "No notices match your search. Try a different term."
              : "Notices published by your admins will appear here."
          }
        />
      ) : (
        <Card className="divide-y divide-border">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">
            <Bell className="size-3.5" aria-hidden="true" />
            {filtered.length} notice{filtered.length === 1 ? "" : "s"} · pinned first
          </div>
          {filtered.map((n) => (
            <NoticeRow key={n.id} notice={n} plainLabels />
          ))}
        </Card>
      )}
    </div>
  );
}
