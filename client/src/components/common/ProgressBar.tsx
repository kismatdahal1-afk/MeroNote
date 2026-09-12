import { cx } from "../../lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
  label?: string;
}

export function ProgressBar({ value, className, label }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cx("h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700", className)}
    >
      <div
        className="h-full rounded-full bg-indigo-500 transition-[width] duration-500 dark:bg-indigo-400"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
