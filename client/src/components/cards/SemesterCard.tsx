import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, FileText } from "lucide-react";
import type { Semester } from "../../types";
import { Card } from "../common/PageHeader";
import { Badge } from "../common/Badge";
import { countResourcesBySemester } from "../../data/selectors";

export function SemesterCard({ semester }: { semester: Semester }) {
  const resourceCount = countResourcesBySemester(semester.id);
  return (
    <Link
      to={`/semesters/${semester.id}`}
      className="group block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      aria-label={`Open ${semester.name}`}
    >
      <Card interactive className="h-full p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <Badge tone="indigo">Sem {semester.number}</Badge>
            <h3 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
              {semester.name}
            </h3>
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/15 to-violet-500/15 text-indigo-600 dark:text-indigo-300">
            <BookOpen className="size-5" aria-hidden="true" />
          </div>
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
          {semester.description}
        </p>
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <FileText className="size-3.5" aria-hidden="true" />
            {resourceCount} resources
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-indigo-400">
            Open <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </div>
      </Card>
    </Link>
  );
}
