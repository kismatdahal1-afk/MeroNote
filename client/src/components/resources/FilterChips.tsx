import { useMemo } from "react";
import { cx } from "../../lib/utils";
import { ALL_RESOURCE_TYPES, RESOURCE_TYPE_CONFIG } from "../../lib/resourceType";
import type { ResourceType } from "../../types";

/** Filter value for resource-type chips. Favorites/Bookmarks also allow "subjects". */
export type TypeFilter = ResourceType | "all" | "subjects";

interface FilterChipsProps<T extends TypeFilter> {
  selected: T;
  counts?: Partial<Record<ResourceType, number>>;
  /** When true, a "Subjects" chip is shown right after "All" (Favorites/Bookmarks only). */
  showSubjects?: boolean;
  /** Total number of saved subjects (unfiltered) — shown on the Subjects chip. */
  subjectsCount?: number;
  /** Total saved items (subjects + resources) — shown on the All chip when provided. */
  allCount?: number;
  onChange: (type: T) => void;
}

export function FilterChips<T extends TypeFilter>({
  selected,
  counts,
  showSubjects = false,
  subjectsCount,
  allCount,
  onChange,
}: FilterChipsProps<T>) {
  const chips = useMemo<(TypeFilter)[]>(
    () => ["all", ...(showSubjects ? ["subjects" as TypeFilter] : []), ...ALL_RESOURCE_TYPES],
    [showSubjects],
  );

  const resourceTotal = counts
    ? Object.values(counts).reduce<number>((sum, n) => sum + (n ?? 0), 0)
    : 0;

  return (
    <div
      role="group"
      aria-label="Filter by resource type"
      className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => {
        const isActive = selected === chip;
        const allLabel =
          showSubjects && allCount !== undefined
            ? `All (${allCount})`
            : `All${counts ? ` (${resourceTotal})` : ""}`;
        const label =
          chip === "all"
            ? allLabel
            : chip === "subjects"
              ? `Subjects${subjectsCount ? ` (${subjectsCount})` : ""}`
              : RESOURCE_TYPE_CONFIG[chip].label + (counts?.[chip] ? ` (${counts[chip]})` : "");
        return (
          <button
            key={chip}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(chip as T)}
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
