import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/utils";

type Variant = "default" | "active" | "danger";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  variant?: Variant;
  size?: "sm" | "md";
  children?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  default:
    "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
  active:
    "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 dark:text-amber-400",
  danger:
    "text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/15 dark:hover:text-red-400",
};

export function IconButton({
  icon: Icon,
  label,
  variant = "default",
  size = "md",
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={rest["aria-pressed"]}
      className={cx(
        "inline-flex items-center justify-center rounded-lg transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
        "disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "size-8" : "size-10",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children ?? <Icon className={size === "sm" ? "size-4" : "size-5"} aria-hidden="true" />}
    </button>
  );
}
