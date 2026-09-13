import type { LucideIcon } from "lucide-react";
import { Card } from "../common/PageHeader";

export interface DashboardStat {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
}

/** Compact 2x2 (mobile) / 4-column (desktop) study summary grid. */
export function StudySummaryGrid({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(({ label, value, hint, icon: Icon }) => (
        <Card key={label} className="p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
          </div>
          <p className="mt-2.5 text-xl font-bold leading-tight text-foreground">{value}</p>
          <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">{hint}</p>
        </Card>
      ))}
    </div>
  );
}
