import { Link } from "react-router-dom";
import { ChevronRight, FileStack, FlaskConical } from "lucide-react";
import type { Subject } from "../../types";
import { Card } from "../common/PageHeader";
import { Badge } from "../common/Badge";
import { countResourcesBySubject } from "../../data/selectors";

export function SubjectCard({ subject }: { subject: Subject }) {
  const count = countResourcesBySubject(subject.id);

  return (
    <Link
      to={`/subjects/${subject.id}`}
      className="group block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={`Open ${subject.name}`}
    >
      <Card interactive className="h-full p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{subject.code}</Badge>
              {subject.category === "practical" && (
                <Badge tone="success">
                  <FlaskConical className="size-3" aria-hidden="true" />
                  Lab
                </Badge>
              )}
              {subject.category === "elective" && (
                <Badge tone="warning">Elective</Badge>
              )}
            </div>
            <h3 className="mt-2.5 truncate text-base font-bold text-foreground group-hover:text-primary">
              {subject.name}
            </h3>
          </div>
          <ChevronRight
            className="mt-1 size-5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            aria-hidden="true"
          />
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {subject.description}
        </p>
        <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <FileStack className="size-3.5" aria-hidden="true" />
          {count} resources
        </div>
      </Card>
    </Link>
  );
}
