import type { ReactNode } from "react";
import { cx } from "../../lib/utils";

interface TopicResourceSectionProps {
  icon?: ReactNode;
  title: string;
  count?: number;
  className?: string;
  children: ReactNode;
}

/** Section heading wrapper reused by Subject Resources / Topics blocks. */
export function TopicResourceSection({
  icon,
  title,
  count,
  className,
  children,
}: TopicResourceSectionProps) {
  return (
    <section aria-labelledby={`section-${title.replace(/\s+/g, "-").toLowerCase()}`} className={cx("mb-7", className)}>
      <h2
        id={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}
        className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground"
      >
        {icon}
        {title}
        {count != null && (
          <span className="font-semibold normal-case text-muted-foreground/70">({count})</span>
        )}
      </h2>
      {children}
    </section>
  );
}
