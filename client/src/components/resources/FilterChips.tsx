import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
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
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
              isActive
                ? "bg-indigo-600 text-white dark:bg-indigo-500"
                : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Reads/writes a `type` search param for filter chips. */
export function useTypeFilter(): [ResourceType | "all", (t: ResourceType | "all") => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("type");
  const value: ResourceType | "all" =
    raw && (ALL_RESOURCE_TYPES as string[]).includes(raw) ? (raw as ResourceType) : "all";

  const setFilter = (t: ResourceType | "all") => {
    setParams(
      t === "all" ? (prev) => { const p = new URLSearchParams(prev); p.delete("type"); return p; } : (prev) => { const p = new URLSearchParams(prev); p.set("type", t); return p; },
      { replace: true },
    );
  };

  return [value, setFilter];
}
