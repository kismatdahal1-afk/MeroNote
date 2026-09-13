import { useMemo } from "react";
import { cx } from "../../lib/utils";
import { ALL_RESOURCE_TYPES, RESOURCE_TYPE_CONFIG } from "../../lib/resourceType";
import type { ResourceType } from "../../types";

interface FilterChipsProps {
  selected: ResourceType | "all";
  counts?: Partial<Record<ResourceType, number>>;
  onChange: (type: ResourceType | "all") => void;
}

export function FilterChips({ selected, counts, onChange }: FilterChipsProps) {
  const chips = useMemo(
    () => ["all", ...ALL_RESOURCE_TYPES] as const,
    [],
  );

  return (
    <div
      role="group"
      aria-label="Filter by resource type"
      className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => {
        const isActive = selected === chip;
        const label =
          chip === "all"
            ? `All${counts ? ` (${Object.values(counts).reduce((a, b) => a! + b!, 0)})` : ""}`
            : RESOURCE_TYPE_CONFIG[chip].label + (counts?.[chip] ? ` (${counts[chip]})` : "");
        return (
          <button
            key={chip}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(chip)}
            className={cx(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              isActive
                ? "bg-primary text-primary-foreground"
                : "border border-border-strong bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
