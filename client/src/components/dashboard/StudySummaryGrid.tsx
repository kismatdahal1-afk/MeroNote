import type { LucideIcon } from "lucide-react";
import { Card } from "../common/PageHeader";

export interface DashboardStat {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
}

/** Single horizontal row on all screens — compact sizing keeps 4 cards legible on mobile. */
export function StudySummaryGrid({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="grid auto-rows-fr grid-cols-4 gap-2 sm:gap-3">
      {stats.map(({ label, value, hint, icon: Icon }) => (
        <Card
          key={label}
          className="flex h-full min-w-0 flex-col items-center p-2 text-center sm:p-4"
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary sm:size-8">
            <Icon className="size-3.5 sm:size-4" aria-hidden="true" />
          </div>
          <p className="mt-1.5 w-full truncate whitespace-nowrap text-center text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:mt-2 sm:text-[11px]">
            {label}
          </p>
          <p
            className="mt-1 w-full truncate whitespace-nowrap text-center text-base font-bold leading-none tracking-tight text-foreground tabular-nums sm:text-xl"
          >
            {value}
          </p>
          <p className="mt-1 w-full truncate whitespace-nowrap text-center text-[10px] font-medium leading-tight text-muted-foreground sm:text-xs">
            {hint}
          </p>
        </Card>
      ))}
    </div>
  );
}
