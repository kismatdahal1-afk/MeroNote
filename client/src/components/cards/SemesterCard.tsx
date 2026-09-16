import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, FileText } from "lucide-react";
import type { Semester } from "../../types";
import { Card } from "../common/PageHeader";
import { countResourcesBySemester } from "../../data/selectors";
import { cx } from "../../lib/utils";
import { useSemesterStatus } from "../../state/SemesterStatusProvider";
import { SemesterStatusChip, type SemesterStatusKind } from "../semesters/SemesterStatus";

interface SemesterCardProps {
  semester: Semester;
}

export function SemesterCard({ semester }: SemesterCardProps) {
  const resourceCount = countResourcesBySemester(semester.id);
  const { getStatus, ongoingSemesterId } = useSemesterStatus();

  const ongoing = ongoingSemesterId === semester.id;
  const status = getStatus(semester.id) as SemesterStatusKind;

  return (
    <Link
      to={`/semesters/${semester.id}`}
      aria-label={`Open ${semester.name}`}
      className="group block h-full rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Card interactive className="flex h-full min-h-[148px] flex-col p-3 transition-shadow group-hover:shadow-card-hover sm:p-4">
        {/* Header row: number block + status chip — same scale as Dashboard overview */}
        <div className="flex items-start justify-between gap-2 sm:gap-2.5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <div
              className={cx(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold leading-none",
                ongoing
                  ? "border-primary/30 bg-primary-muted text-primary"
                  : "border-border bg-surface-muted text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {String(semester.number).padStart(2, "0")}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold leading-tight tracking-tight text-foreground group-hover:text-primary">
                {semester.name}
              </h3>
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {semester.credits} credits
              </p>
            </div>
          </div>
          <SemesterStatusChip status={status} />
        </div>

        {/* Description — same hint scale as Dashboard, fixed height for equal cards */}
        <p className="mt-2.5 line-clamp-2 min-h-[32px] text-xs font-medium leading-relaxed text-muted-foreground">
          {semester.description}
        </p>

        {/* Meta counts — same pill-like row, consistent gap */}
        <div className="mt-auto flex items-center gap-3 pt-3 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 truncate">
            <BookOpen className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{semester.subjectCount} subjects</span>
          </span>
          <span className="inline-flex items-center gap-1.5 truncate">
            <FileText className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{resourceCount} resources</span>
          </span>
          <span className="ml-auto hidden shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-primary opacity-0 transition-opacity group-hover:opacity-100 sm:inline-flex">
            Open <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </div>
      </Card>
    </Link>
  );
}
