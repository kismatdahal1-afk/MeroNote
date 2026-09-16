import { Megaphone, Pin } from "lucide-react";
import type { Notice, NoticeWithState } from "../../types";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import { noticeWithState } from "../../state/cmsStore";
import { cx, formatDate } from "../../lib/utils";

const PRIORITY_TONE: Record<Notice["priority"], "success" | "warning" | "error"> = {
  low: "success",
  normal: "warning",
  high: "error",
  urgent: "error",
};

/** Display labels — the model stores "normal", shown as "Medium". */
const PRIORITY_LABEL: Record<Notice["priority"], string> = {
  low: "Low",
  normal: "Medium",
  high: "High",
  urgent: "Urgent",
};

const ANNOUNCER_LABEL: Record<Notice["announcer"], string> = {
  administration: "Administration",
  "csit-department": "CSIT Department",
  examination: "Examination Section",
  library: "Library",
};

/**
 * Announcement-style detail popup for a single notice — shared by the
 * Admin Notice page, the Student Notice page, and the dashboard boards.
 * Horizontal header (icon left, title right) with a single compact
 * metadata line: announcer · priority · notice date · published date.
 */
export function NoticeDetailModal({
  notice,
  open,
  onClose,
}: {
  notice: Notice | NoticeWithState;
  open: boolean;
  onClose: () => void;
}) {
  const withState = noticeWithState(notice);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Notice"
      className="max-w-md"
      footer={
        <Button onClick={onClose} className="w-full sm:w-auto">
          Close
        </Button>
      }
    >
      {/* Header: icon left, title right */}
      <div className="rounded-2xl border border-primary/20 bg-primary-muted/50 p-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <span className="flex size-13 shrink-0 items-center justify-center rounded-full bg-primary p-3.5 text-primary-foreground shadow-md ring-4 ring-primary/15">
            <Megaphone className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-primary">
              Notice
              {notice.pinned && (
                <span className="inline-flex items-center gap-0.5 normal-case tracking-normal">
                  <Pin className="size-3 fill-current" aria-hidden="true" /> Pinned
                </span>
              )}
            </p>
            <h2 className="mt-1 break-words text-lg font-extrabold leading-snug text-foreground">
              {notice.heading}
            </h2>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground">
            {ANNOUNCER_LABEL[notice.announcer] ?? notice.announcer}
          </span>
          <Badge tone={PRIORITY_TONE[notice.priority]}>
            <span className="text-[10px]">{PRIORITY_LABEL[notice.priority]}</span>
          </Badge>
          <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground">
            {formatDate(notice.date)}{" "}
            <span
              className={cx(
                "font-bold",
                withState.dayState === "today"
                  ? "text-warning"
                  : withState.dayState === "upcoming"
                    ? "text-success"
                    : "text-muted-foreground/60",
              )}
            >
              {withState.dayState === "today"
                ? "Today"
                : withState.dayState === "upcoming"
                  ? `${withState.dayCount}d left`
                  : "Completed"}
            </span>
          </span>
          <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground">
            Published {formatDate(notice.publishedAt ?? notice.createdAt)}
          </span>
        </div>
      </div>

      <div className="my-4 border-t border-border" aria-hidden="true" />

      {/* Reading section */}
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">
        Notice Details
      </p>
      <div className="mt-2 max-h-[42vh] overflow-y-auto">
        <p className="whitespace-pre-wrap break-words text-[15px] font-medium leading-[1.75] text-foreground">
          {notice.subtext || "No description provided."}
        </p>
      </div>
    </Modal>
  );
}
