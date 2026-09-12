import { Link } from "react-router-dom";
import { ChevronRight, FlaskConical, Star } from "lucide-react";
import type { Subject } from "../../types";
import { Card } from "../common/PageHeader";
import { Badge } from "../common/Badge";
import { countResourcesBySubject } from "../../data/selectors";

export function SubjectCard({ subject }: { subject: Subject }) {
  const count = countResourcesBySubject(subject.id);

  return (
    <Link
      to={`/subjects/${subject.id}`}
      className="group block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      aria-label={`Open ${subject.name}`}
    >
      <Card interactive className="h-full p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="sky">{subject.code}</Badge>
              {subject.category === "practical" && (
                <Badge tone="emerald">
                  <FlaskConical className="size-3" aria-hidden="true" />
                  Lab
                </Badge>
              )}
              {subject.category === "elective" && (
                <Badge tone="amber">Elective</Badge>
              )}
            </div>
            <h3 className="mt-2.5 truncate text-base font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
              {subject.name}
            </h3>
          </div>
          <ChevronRight
            className="mt-1 size-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500 dark:text-slate-600"
            aria-hidden="true"
          />
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
          {subject.description}
        </p>
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Star className="size-3.5 text-amber-400" aria-hidden="true" />
            {count} resources
          </span>
        </div>
      </Card>
    </Link>
  );
}
