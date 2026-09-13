import type { ReactNode } from "react";
import { cx } from "../../lib/utils";

interface StatPillProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  className?: string;
}

/** Small icon + value + label metric. */
export function StatPill({ icon, label, value, className }: StatPillProps) {
  return (
    <div
      className={cx(
        "inline-flex min-w-0 flex-col gap-0.5 rounded-lg bg-surface-muted/70 px-3 py-2",
        className,
      )}
    >
      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="truncate text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}
