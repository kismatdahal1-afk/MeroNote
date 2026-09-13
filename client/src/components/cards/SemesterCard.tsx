import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, FileText, CircleCheck, Circle, Clock } from "lucide-react";
import type { Semester } from "../../types";
import { Card } from "../common/PageHeader";
import { Badge } from "../common/Badge";
import { countResourcesBySemester } from "../../data/selectors";
import { cx } from "../../lib/utils";

const STATUS_CONFIG: Record<
  Semester["status"],
  { label: string; tone: "success" | "primary" | "neutral"; icon: typeof CircleCheck }
> = {
  passed: { label: "Passed", tone: "success", icon: CircleCheck },
  active: { label: "Active", tone: "primary", icon: Circle },
  upcoming: { label: "Upcoming", tone: "neutral", icon: Clock },
};

export function SemesterCard({ semester }: { semester: Semester }) {
  const resourceCount = countResourcesBySemester(semester.id);
  const status = STATUS_CONFIG[semester.status];
  const StatusIcon = status.icon;

  return (
    <Link
      to={`/semesters/${semester.id}`}
      className="group block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={`Open ${semester.name}`}
    >
      <Card interactive className="h-full p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={status.tone}>
                <StatusIcon className="size-3" aria-hidden="true" />
                {status.label}
              </Badge>
              <span className="text-xs font-bold text-muted-foreground">
                {semester.credits} credits
              </span>
            </div>
            <h3 className="text-base font-bold text-foreground group-hover:text-primary">
              {semester.name}
            </h3>
          </div>
          <div
            className={cx(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              semester.status === "active"
                ? "bg-primary-muted text-primary"
                : "bg-surface-muted text-muted-foreground",
            )}
          >
            <BookOpen className="size-5" aria-hidden="true" />
          </div>
        </div>
        <p className="mt-3 line-clamp-2 text-sm font-medium text-muted-foreground">
          {semester.description}
        </p>
        <div className="mt-4 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <FileText className="size-3.5" aria-hidden="true" />
            {semester.subjectCount} subjects · {resourceCount} resources
          </span>
          <span className="inline-flex items-center gap-1 font-bold text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Open <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </div>
      </Card>
    </Link>
  );
}
