import { CalendarClock } from "lucide-react";
import { Card } from "../common/PageHeader";
import { programInfo } from "../../data/mock";
import { getActiveSemester } from "../../data/selectors";
import { daysUntil } from "../../lib/utils";

/** Compact exam countdown card under the dashboard greeting. */
export function ExamCard() {
  const days = daysUntil(programInfo.exam.date);
  const semester = getActiveSemester();

  return (
    <Card className="flex items-center gap-3.5 p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
        <CalendarClock className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">
          {programInfo.exam.title}
        </p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">
          {programInfo.exam.scope} · {semester.name}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-lg font-bold leading-tight text-primary">{days}</p>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Days Left
        </p>
      </div>
    </Card>
  );
}
