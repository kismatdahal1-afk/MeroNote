import type { ReactNode } from "react";
import { cx } from "../../lib/utils";

type Tone = "neutral" | "indigo" | "emerald" | "amber" | "red" | "sky";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-500/10 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  indigo: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
  red: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-300",
  sky: "bg-sky-500/10 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
};

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
