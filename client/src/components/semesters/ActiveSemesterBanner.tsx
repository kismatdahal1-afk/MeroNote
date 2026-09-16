import { useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, BookOpen, CreditCard, CalendarClock, CalendarDays, Play } from "lucide-react";
import { Card } from "../common/PageHeader";
import { ProgressRing } from "../common/ProgressRing";
import { calculateSemesterProgress } from "../../lib/semesterProgress";
import { getSemesterById } from "../../data/selectors";
import { getSubjectsBySemester, countResourcesBySemester } from "../../data/selectors";
import { useSemesterStatus, type SemesterTermDates } from "../../state/SemesterStatusProvider";
import { useCmsSync } from "../common/CmsSync";
import { StatPill } from "./StatPill";
import { cx } from "../../lib/utils";

interface ActiveSemesterBannerProps {
  semesterId: string;
  /** Show the "Continue Studying" launcher. Hidden on the semester
   *  details page itself, where it would link to the current page. */
  showLauncher?: boolean;
}

/** yyyy-mm-dd for date inputs, relative to today. */
function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * "Current semester" banner, shared by the Semester Library and the
 * ongoing semester's details page so both show the same banner.
 * Renders ONLY for the single semester the user marked Ongoing. All progress
 * numbers derive from the user-chosen start/end dates — nothing is hardcoded.
 */
export function ActiveSemesterBanner({ semesterId, showLauncher = true }: ActiveSemesterBannerProps) {
  useCmsSync();
  const { getStatus, getDates, setDates } = useSemesterStatus();
  const semester = getSemesterById(semesterId);
  const subjects = getSubjectsBySemester(semesterId);
  const resourceCount = countResourcesBySemester(semesterId);

  const stored = getDates(semesterId);
  const today = toDateInputValue(new Date());
  const [startDate, setStartDate] = useState(stored?.startDate ?? today);
  const [endDate, setEndDate] = useState(
    stored?.endDate ?? toDateInputValue(new Date(Date.now() + 120 * 86400000)),
  );

  const datesValid = Boolean(startDate && endDate && endDate > startDate);
  const progress = datesValid
    ? calculateSemesterProgress(startDate, endDate)
    : { totalDays: 0, elapsedDays: 0, remainingDays: 0, percentage: 0, isComplete: false };

  const status = getStatus(semesterId);
  if (status !== "ongoing") return null;

  const save = () => {
    if (!datesValid) return;
    const next: SemesterTermDates = { startDate, endDate };
    setDates(semesterId, next);
  };

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center">
        {/* Identity + ring */}
        <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
          <div className="relative shrink-0">
            <ProgressRing
              value={progress.percentage / 100}
              size={88}
              strokeWidth={7}
              label="Ongoing semester progress"
            />
          </div>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
              <GraduationCap className="size-3.5" aria-hidden="true" />
              Current Semester
            </p>
            <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {semester?.name ?? "Current Semester"}
            </h2>
            <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
              BSc CSIT · Ongoing Enrollment
            </p>
          </div>
        </div>

        {/* Metrics — derived from the date range */}
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[22.5rem] lg:grid-cols-2 xl:grid-cols-4">
          <StatPill
            icon={<CalendarDays className="size-3" aria-hidden="true" />}
            label="Total"
            value={datesValid ? `${progress.totalDays}d` : "—"}
          />
          <StatPill
            icon={<CreditCard className="size-3" aria-hidden="true" />}
            label="Elapsed"
            value={datesValid ? `${progress.elapsedDays}d` : "—"}
          />
          <StatPill
            icon={<CalendarClock className="size-3" aria-hidden="true" />}
            label="Remaining"
            value={datesValid ? `${progress.remainingDays}d` : "—"}
          />
          <StatPill
            icon={<BookOpen className="size-3" aria-hidden="true" />}
            label="Subjects"
            value={`${subjects.length} · ${resourceCount} res`}
          />
        </div>

        {/* Launcher */}
        {showLauncher && (
          <Link
            to={`/semesters/${semesterId}`}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Play className="size-4 fill-current" aria-hidden="true" />
            Continue Studying
          </Link>
        )}
      </div>

      {/* Term date inputs (editable while ongoing) */}
      <div className="grid grid-cols-2 gap-3 border-t border-border bg-surface-muted/40 px-5 py-3.5 sm:flex sm:flex-row sm:items-end sm:gap-6 sm:px-6">
        <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-52">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Start date
          </span>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-52">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            End date
          </span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={!datesValid || (stored?.startDate === startDate && stored?.endDate === endDate)}
          className={cx(
            "col-span-2 h-9 shrink-0 rounded-lg px-4 text-sm font-bold transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            "disabled:pointer-events-none disabled:opacity-40",
            "bg-primary text-primary-foreground hover:bg-primary-hover",
          )}
        >
          Save Dates
        </button>
        {!datesValid && (
          <p role="alert" className="col-span-2 text-xs font-medium text-error sm:mb-2">
            End date must be after start date.
          </p>
        )}
      </div>
    </Card>
  );
}
