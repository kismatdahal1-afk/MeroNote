import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  FileText,
  Layers,
  PenLine,
  HelpCircle,
  FileArchive,
  Flame,
  Sparkles,
  FlaskConical,
  ClipboardList,
  Package,
  Bookmark,
} from "lucide-react";
import type { ResourceType } from "../types";

interface ResourceTypeConfig {
  label: string;
  icon: LucideIcon;
  /** token-based badge classes */
  badgeClass: string;
}

/**
 * Type tints use semantic state tokens that adapt automatically to the
 * warm cream light theme and near-black monochrome dark theme. Dark
 * neutral (primary/secondary) dominates; state hues only mark resource categories.
 */
export const RESOURCE_TYPE_CONFIG: Record<ResourceType, ResourceTypeConfig> = {
  book: {
    label: "Book",
    icon: BookOpen,
    badgeClass: "bg-primary-muted text-primary",
  },
  short_note: {
    label: "Short Notes",
    icon: FileText,
    badgeClass: "bg-accent/15 text-accent",
  },
  handwritten_note: {
    label: "Handwritten Notes",
    icon: PenLine,
    badgeClass: "bg-accent/15 text-accent",
  },
  extra_note: {
    label: "Extra Notes",
    icon: Layers,
    badgeClass: "bg-accent/15 text-accent",
  },
  questions: {
    label: "Question",
    icon: HelpCircle,
    badgeClass: "bg-secondary/15 text-secondary",
  },
  important_questions: {
    label: "Important Question",
    icon: Sparkles,
    badgeClass: "bg-warning-muted text-warning",
  },
  hot_topic: {
    label: "Hot Topic",
    icon: Flame,
    badgeClass: "bg-warning-muted text-warning",
  },
  topic: {
    label: "Topic",
    icon: Bookmark,
    badgeClass: "bg-accent/15 text-accent",
  },
  past_paper: {
    label: "Past Paper",
    icon: FileArchive,
    badgeClass: "bg-warning-muted text-warning",
  },
  revision_note: {
    label: "Revision Notes",
    icon: ClipboardList,
    badgeClass: "bg-error-muted text-error",
  },
  practical: {
    label: "Practical Lab",
    icon: FlaskConical,
    badgeClass: "bg-success-muted text-success",
  },
  custom: {
    label: "Custom",
    icon: Package,
    badgeClass: "bg-surface-muted text-muted-foreground",
  },
} as Record<ResourceType, ResourceTypeConfig>;

// Back-compat: old persisted resources may have type "other" — alias to custom
(RESOURCE_TYPE_CONFIG as Record<string, ResourceTypeConfig>).other = RESOURCE_TYPE_CONFIG.custom;

/** Canonical display order for resource types — matches spec exactly. */
export const ALL_RESOURCE_TYPES: ResourceType[] = [
  "book",
  "short_note",
  "handwritten_note",
  "extra_note",
  "questions",
  "important_questions",
  "hot_topic",
  "topic",
  "past_paper",
  "revision_note",
  "practical",
  "custom",
];

export function resourceTypeLabel(type: ResourceType): string {
  // Back-compat: old data may have "other" which is now "custom"
  if ((type as string) === "other") return "Custom";
  return RESOURCE_TYPE_CONFIG[type]?.label ?? String(type);
}
