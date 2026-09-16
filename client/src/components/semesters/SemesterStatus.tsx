import { CircleCheck, CircleDot, Clock } from "lucide-react";
import { cx } from "../../lib/utils";

/* ------------------------------------------------------------------ */
/* Status chip — icon + text (never color alone)                       */
/* ------------------------------------------------------------------ */

export type SemesterStatusKind = "ongoing" | "passed" | "upcoming";

const STATUS_META: Record<
  SemesterStatusKind,
  { label: string; icon: typeof CircleCheck; classes: string }
> = {
  ongoing: {
    label: "Ongoing",
    icon: CircleDot,
    classes: "bg-primary text-primary-foreground",
  },
  passed: {
    label: "Passed",
    icon: CircleCheck,
    classes: "bg-success-muted text-success",
  },
  upcoming: {
    label: "Upcoming",
    icon: Clock,
    classes: "bg-warning-muted text-warning",
  },
};

interface SemesterStatusChipProps {
  status: SemesterStatusKind;
  className?: string;
}

/** Compact status pill: icon-only on mobile (room for the semester name),
 *  icon + text from sm up. Desktop rendering is unchanged. */
export function SemesterStatusChip({ status, className }: SemesterStatusChipProps) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      title={meta.label}
      className={cx(
        "inline-flex shrink-0 items-center gap-0 rounded-full px-1.5 py-1 text-xs font-bold sm:gap-1.5 sm:px-2.5",
        meta.classes,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">{meta.label}</span>
      <span className="sr-only sm:hidden">{meta.label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Status control — single control on the Semester Detail page         */
/* Clicking cycles Upcoming -> Ongoing -> Passed -> Upcoming.          */
/* ------------------------------------------------------------------ */

const CYCLE_ORDER: SemesterStatusKind[] = ["upcoming", "ongoing", "passed"];

const NEXT_LABEL: Record<SemesterStatusKind, string> = {
  upcoming: "Ongoing",
  ongoing: "Passed",
  passed: "Upcoming",
};

interface SemesterStatusControlProps {
  status: SemesterStatusKind;
  onChange: (status: SemesterStatusKind) => void;
}

/** Compact single-button status cycler. */
export function SemesterStatusControl({
  status,
  onChange,
}: SemesterStatusControlProps) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const next = CYCLE_ORDER[(CYCLE_ORDER.indexOf(status) + 1) % CYCLE_ORDER.length];

  return (
    <button
      type="button"
      aria-label={`Semester status: ${meta.label}. Activate to change to ${NEXT_LABEL[status]}.`}
      title={`Change status to ${NEXT_LABEL[status]}`}
      onClick={() => onChange(next)}
      className={cx(
        "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-bold transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "hover:opacity-90 active:scale-[0.97]",
        meta.classes,
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {meta.label}
    </button>
  );
}
