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
      <Card interactive className="flex h-full flex-col p-4 transition-shadow group-hover:shadow-card-hover sm:p-5">
        {/* Header row: number block + status chip */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cx(
                "flex size-11 shrink-0 items-center justify-center rounded-xl border text-sm font-bold",
                ongoing
                  ? "border-primary/30 bg-primary-muted text-primary"
                  : "border-border bg-surface-muted text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {String(semester.number).padStart(2, "0")}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-foreground group-hover:text-primary">
                {semester.name}
              </h3>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                {semester.credits} credits
              </p>
            </div>
          </div>
          <SemesterStatusChip status={status} />
        </div>

        {/* Description */}
        <p className="mt-3 line-clamp-2 min-h-10 text-sm font-medium text-muted-foreground">
          {semester.description}
        </p>

        {/* Meta counts */}
        <div className="mt-auto flex items-center gap-4 pt-4 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="size-3.5 text-primary" aria-hidden="true" />
            {semester.subjectCount} subjects
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileText className="size-3.5 text-primary" aria-hidden="true" />
            {resourceCount} resources
          </span>
          <span className="ml-auto inline-flex items-center gap-1 font-bold text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Open <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </div>
      </Card>
    </Link>
  );
}
