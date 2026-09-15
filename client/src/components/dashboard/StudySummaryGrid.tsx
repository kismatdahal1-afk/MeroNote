import type { LucideIcon } from "lucide-react";
import { Card } from "../common/PageHeader";

export interface DashboardStat {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
}

/** Compact 2x2 (mobile) / 4-column (desktop) — vertical centered, single-line labels. */
export function StudySummaryGrid({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="grid auto-rows-fr grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(({ label, value, hint, icon: Icon }) => (
        <Card key={label} className="flex h-full flex-col items-center p-3 text-center sm:p-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary sm:size-8">
            <Icon className="size-4" aria-hidden="true" />
          </div>
          <p className="mt-2 w-full truncate whitespace-nowrap text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
            {label}
          </p>
          <p className="mt-1 w-full truncate whitespace-nowrap text-center text-lg font-bold leading-none tracking-tight text-foreground tabular-nums sm:text-xl">
            {value}
          </p>
          <p className="mt-1 w-full truncate whitespace-nowrap text-center text-[11px] font-medium leading-tight text-muted-foreground sm:text-xs">
            {hint}
          </p>
        </Card>
      ))}
    </div>
  );
}
