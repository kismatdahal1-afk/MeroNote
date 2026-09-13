import { useEffect, useId, useRef } from "react";
import type { Topic } from "../../types";
import { Card } from "../common/PageHeader";
import { cx } from "../../lib/utils";

interface TopicAccordionProps {
  topic: Topic;
  /** Resource count shown next to the title. */
  resourceCount: number;
  isOpen: boolean;
  onToggle: (topicId: string) => void;
  children: React.ReactNode;
}

/**
 * Collapsible topic card. One-topic-open behavior is controlled by the
 * parent; this component only animates its own expansion.
 *
 * Animation: the content wrapper animates grid-template-rows 0fr → 1fr
 * plus opacity, giving a smooth height transition without JS measurement
 * or abrupt display switching. Disabled automatically for users with
 * reduced-motion preferences via the global CSS rule.
 */
export function TopicAccordion({
  topic,
  resourceCount,
  isOpen,
  onToggle,
  children,
}: TopicAccordionProps) {
  const panelId = useId();
  const headerRef = useRef<HTMLButtonElement>(null);

  // Guide the user to the expanded content: after the 300ms expand animation
  // settles, bring the topic header to a comfortable position below the
  // sticky app header (offset handled by scroll-mt on the button).
  useEffect(() => {
    if (!isOpen || !headerRef.current) return;
    const header = headerRef.current;

    const top = header.getBoundingClientRect().top;
    if (top < 64 || top > window.innerHeight * 0.4) {
      const timer = window.setTimeout(() => {
        header.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 340);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <Card className={cx("overflow-hidden transition-colors", isOpen && "border-primary/40")}>
      <button
        ref={headerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => onToggle(topic.id)}
        className={cx(
          "scroll-mt-20 flex w-full items-center gap-3.5 p-4 text-left transition-colors sm:p-5",
          "hover:bg-surface-hover/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          isOpen && "bg-surface-hover/40",
        )}
      >
        <span
          className={cx(
            "flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition-colors",
            isOpen
              ? "border-primary/30 bg-primary-muted text-primary"
              : "border-border bg-surface-muted text-muted-foreground",
          )}
          aria-hidden="true"
        >
          {String(topic.order).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-foreground sm:text-base">
            {topic.title}
          </span>
          {topic.description && (
            <span className="mt-0.5 line-clamp-1 block text-xs font-medium text-muted-foreground">
              {topic.description}
            </span>
          )}
        </span>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
          {resourceCount > 0
            ? `${resourceCount} resource${resourceCount === 1 ? "" : "s"}`
            : "No resources"}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cx(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
            isOpen && "rotate-180 text-primary",
          )}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div
        id={panelId}
        className={cx(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className={cx("overflow-hidden", !isOpen && "invisible")}>
          <div className="border-t border-border p-4 sm:p-5">{children}</div>
        </div>
      </div>
    </Card>
  );
}
