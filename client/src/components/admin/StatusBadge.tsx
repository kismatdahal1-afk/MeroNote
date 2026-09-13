import type { PublishStatus } from "../../types";
import { Badge } from "../common/Badge";

/** Publish-status badge shared across all admin tables. */
export function StatusBadge({ status }: { status: PublishStatus }) {
  if (status === "published") return <Badge tone="success">Published</Badge>;
  if (status === "draft") return <Badge tone="warning">Draft</Badge>;
  return <Badge tone="neutral">Hidden</Badge>;
}

/** Editable status chip buttons — click to cycle/publish actions are wired by parent. */
export function StatusToggleGroup({
  value,
  onChange,
  size = "sm",
}: {
  value: PublishStatus;
  onChange: (next: PublishStatus) => void;
  size?: "sm" | "md";
}) {
  const options: PublishStatus[] = ["published", "draft", "hidden"];
  const tone = (opt: PublishStatus) =>
    opt === value
      ? opt === "published"
        ? "bg-success text-white"
        : opt === "draft"
          ? "bg-warning text-white"
          : "bg-secondary text-white"
      : "border border-border-strong bg-surface text-muted-foreground hover:bg-surface-hover";
  return (
    <div role="group" aria-label="Publish status" className="inline-flex overflow-hidden rounded-lg">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          aria-pressed={value === opt}
          onClick={() => onChange(opt)}
          className={
            size === "sm"
              ? `px-2 py-1 text-[11px] font-bold capitalize transition-colors ${tone(opt)}`
              : `px-3 py-1.5 text-xs font-bold capitalize transition-colors ${tone(opt)}`
          }
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
