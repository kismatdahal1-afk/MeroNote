import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/utils";

type Variant = "default" | "active" | "danger" | "bar" | "favorite" | "bookmark";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  variant?: Variant;
  size?: "sm" | "md";
  /** fill the icon (for selected/pressed state) */
  filled?: boolean;
  children?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  default:
    "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
  active:
    "bg-warning-muted text-warning hover:bg-warning-muted hover:text-warning dark:bg-success-muted dark:text-success dark:hover:bg-success-muted dark:hover:text-success",
  danger:
    "text-muted-foreground hover:bg-error-muted hover:text-error",
  bar:
    "text-foreground/75 hover:bg-surface-hover hover:text-foreground",
  favorite: "text-favorite hover:text-favorite",
  bookmark: "text-bookmark hover:text-bookmark",
};

export function IconButton({
  icon: Icon,
  label,
  variant = "default",
  size = "md",
  filled = false,
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
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "size-8" : "size-10",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children ?? (
        <Icon
          className={cx(size === "sm" ? "size-4" : "size-5", filled && "fill-current")}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
