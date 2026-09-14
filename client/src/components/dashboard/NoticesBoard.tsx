import { Link } from "react-router-dom";
import { Pin, Bell, CalendarClock, CalendarCheck, CalendarX } from "lucide-react";
import type { NoticeWithState } from "../../types";
import { Card } from "../common/PageHeader";
import { Badge } from "../common/Badge";
import { cx, formatDate } from "../../lib/utils";

const TYPE_TONE: Record<NoticeWithState["type"], "error" | "warning" | "primary" | "accent" | "neutral"> = {
  exam: "error",
  deadline: "warning",
  assignment: "warning",
  event: "accent",
  important: "error",
  announcement: "primary",
  reminder: "accent",
  general: "neutral",
};

const PRIORITY_TONE: Record<NoticeWithState["priority"], "success" | "warning" | "error"> = {
  low: "success",
  normal: "warning",
  high: "error",
};

/** One notice row with its computed day state (X days remaining / Today / Past).
 *  Shared by the dashboard board and the full student Notices page. */
export function NoticeRow({ notice }: { notice: NoticeWithState }) {
  const DayIcon = notice.dayState === "today" ? CalendarCheck : notice.dayState === "upcoming" ? CalendarClock : CalendarX;
  return (
    <div
      className={cx(
        "flex items-start gap-3 p-4 transition-colors",
        notice.pinned && "bg-primary-muted/40",
      )}
    >
      <span
        className={cx(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          notice.dayState === "today"
            ? "bg-warning-muted text-warning"
            : notice.dayState === "upcoming"
              ? "bg-success-muted text-success"
              : "bg-surface-muted text-muted-foreground",
        )}
        aria-hidden="true"
      >
        <DayIcon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {notice.pinned && <Pin className="size-3 fill-current text-primary" aria-label="Pinned" />}
          <Badge
            tone={TYPE_TONE[notice.type]}
            className={notice.type === "exam" ? "dark:bg-warning-muted dark:text-warning" : undefined}
          >
            <span className="capitalize">{notice.type}</span>
          </Badge>
          {notice.priority === "high" && <Badge tone={PRIORITY_TONE[notice.priority]}>High priority</Badge>}
        </div>
        <p className="mt-1.5 text-sm font-bold leading-snug text-foreground">{notice.heading}</p>
        {notice.subtext && (
          <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-muted-foreground">
            {notice.subtext}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-semibold text-muted-foreground">{formatDate(notice.date)}</p>
        <p
          className={cx(
            "mt-0.5 text-xs font-bold",
            notice.dayState === "today"
              ? "text-warning"
              : notice.dayState === "upcoming"
                ? "text-success"
                : "text-muted-foreground/70",
          )}
        >
          {notice.dayState === "today"
            ? "Today"
            : notice.dayState === "upcoming"
              ? `${notice.dayCount} day${notice.dayCount === 1 ? "" : "s"} remaining`
              : "Completed"}
        </p>
      </div>
    </div>
  );
}

/** Student dashboard notices section — loads from the CMS store (admin-managed). */
export function NoticesBoard({ notices }: { notices: NoticeWithState[] }) {
  if (notices.length === 0) return null;

  return (
    <section aria-labelledby="notices-heading" className="mb-7">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="notices-heading" className="flex items-center gap-2 text-base font-bold text-foreground">
          <Bell className="size-4 text-primary" aria-hidden="true" />
          Notices &amp; Reminders
        </h2>
        <Link
          to="/notices"
          className="rounded text-xs font-bold text-primary hover:text-primary-hover hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          See all →
        </Link>
      </div>
      <Card className="divide-y divide-border">
        {/* Dashboard preview — the 2 most recent notices; full list on /notices */}
        {notices.slice(0, 2).map((n) => (
          <NoticeRow key={n.id} notice={n} />
        ))}
      </Card>
    </section>
  );
}
