import { useState } from "react";
import { Link } from "react-router-dom";
import { Pin, Bell, CalendarClock, CalendarCheck, CalendarX } from "lucide-react";
import type { NoticeWithState } from "../../types";
import { Card } from "../common/PageHeader";
import { Badge } from "../common/Badge";
import { NoticeDetailModal } from "../notices/NoticeDetailModal";
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
  urgent: "error",
};

/** Plain-text color equivalents of the badge tones — used on student surfaces
 *  so type words (announcement, high priority, …) show color only, with no
 *  badge/pill background. Admin surfaces keep the default badge look. */
const TYPE_TEXT: Record<NoticeWithState["type"], string> = {
  exam: "text-error dark:text-warning",
  deadline: "text-warning",
  assignment: "text-warning",
  event: "text-accent",
  important: "text-error",
  announcement: "text-primary",
  reminder: "text-accent",
  general: "text-muted-foreground",
};

const PRIORITY_TEXT: Record<NoticeWithState["priority"], string> = {
  low: "text-success",
  normal: "text-warning",
  high: "text-error",
  urgent: "text-error",
};

const ANNOUNCER_LABEL: Record<NoticeWithState["announcer"], string> = {
  administration: "Administration",
  "csit-department": "CSIT Department",
  examination: "Examination Section",
  library: "Library",
};

/** One notice row with its computed day state (X days remaining / Today / Past).
 *  Shared by the dashboard boards (student + admin) and the full student
 *  Notices page. The description always shows a single truncated line —
 *  the full text is available in the detail popup.
 *  Clicking a row opens the portrait-style detail popup.
 *  `compact` renders a slightly shorter row for the dashboard preview. */
export function NoticeRow({ notice, compact = false, plainLabels = false }: { notice: NoticeWithState; compact?: boolean; /** Student surfaces: plain colored text, no badge background. Admin keeps badges. */ plainLabels?: boolean }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const DayIcon = notice.dayState === "today" ? CalendarCheck : notice.dayState === "upcoming" ? CalendarClock : CalendarX;
  return (
    <>
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open notice: ${notice.heading}`}
      onClick={() => setDetailOpen(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setDetailOpen(true);
        }
      }}
      className={cx(
        "flex cursor-pointer items-start gap-3 transition-colors hover:bg-surface-hover",
        compact ? "px-4 py-2.5" : "p-4",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
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
          {plainLabels ? (
            <span className={cx("text-xs font-semibold capitalize", TYPE_TEXT[notice.type])}>
              {notice.type}
            </span>
          ) : (
            <Badge
              tone={TYPE_TONE[notice.type]}
              className={notice.type === "exam" ? "dark:bg-warning-muted dark:text-warning" : undefined}
            >
              <span className="capitalize">{notice.type}</span>
            </Badge>
          )}
          {notice.priority === "high" &&
            (plainLabels ? (
              <span className={cx("text-xs font-semibold", PRIORITY_TEXT[notice.priority])}>
                High priority
              </span>
            ) : (
              <Badge tone={PRIORITY_TONE[notice.priority]}>High priority</Badge>
            ))}
        </div>
        <p className={cx("break-words text-sm font-bold leading-snug text-foreground", compact ? "mt-1" : "mt-1.5")}>{notice.heading}</p>
        <p className="mt-0.5 break-words text-[11px] font-medium leading-tight text-muted-foreground/60">
          {ANNOUNCER_LABEL[notice.announcer] ?? notice.announcer}
        </p>
        {notice.subtext && (
          <p className="mt-1 truncate text-xs font-medium leading-relaxed text-muted-foreground">
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
    <NoticeDetailModal notice={notice} open={detailOpen} onClose={() => setDetailOpen(false)} plainPriority={plainLabels} />
    </>
  );
}

/** Dashboard notices section — loads from the CMS store (admin-managed).
 *  Shared by Student and Admin dashboards — same data source and ordering. */
export function NoticesBoard({
  notices,
  seeAllTo = "/notices",
  plainLabels = false,
}: {
  notices: NoticeWithState[];
  seeAllTo?: string;
  /** Student surfaces: plain colored text, no badge background. Admin keeps badges. */
  plainLabels?: boolean;
}) {
  if (notices.length === 0) return null;

  return (
    <section aria-labelledby="notices-heading" className="mb-7">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="notices-heading" className="flex items-center gap-2 text-base font-bold text-foreground">
          <Bell className="size-4 text-primary" aria-hidden="true" />
          Notices &amp; Reminders
        </h2>
        <Link
          to={seeAllTo}
          className="rounded text-xs font-bold text-primary hover:text-primary-hover hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          See all →
        </Link>
      </div>
      <Card className="divide-y divide-border">
        {/* Dashboard preview — the 2 most recent notices; full list on /notices */}
        {notices.slice(0, 2).map((n) => (
          <NoticeRow key={n.id} notice={n} compact plainLabels={plainLabels} />
        ))}
      </Card>
    </section>
  );
}
