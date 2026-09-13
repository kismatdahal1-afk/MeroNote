import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  FileText,
  Layers,
  HelpCircle,
  FileArchive,
  Sparkles,
  FlaskConical,
  ClipboardList,
  Package,
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
 * warm cream light theme and deep navy dark theme. Dark blue (primary/
 * secondary) dominates; state hues only mark resource categories.
 */
export const RESOURCE_TYPE_CONFIG: Record<ResourceType, ResourceTypeConfig> = {
  book: {
    label: "Book",
    icon: BookOpen,
    badgeClass: "bg-primary-muted text-primary",
  },
  short_note: {
    label: "Short Note",
    icon: FileText,
    badgeClass: "bg-accent/15 text-accent",
  },
  extra_note: {
    label: "Extra Note",
    icon: Layers,
    badgeClass: "bg-accent/15 text-accent",
  },
  questions: {
    label: "Questions",
    icon: HelpCircle,
    badgeClass: "bg-secondary/15 text-secondary",
  },
  past_paper: {
    label: "Past Paper",
    icon: FileArchive,
    badgeClass: "bg-warning-muted text-warning",
  },
  important_questions: {
    label: "Important Questions",
    icon: Sparkles,
    badgeClass: "bg-warning-muted text-warning",
  },
  practical: {
    label: "Practical/Lab",
    icon: FlaskConical,
    badgeClass: "bg-success-muted text-success",
  },
  revision_note: {
    label: "Revision Note",
    icon: ClipboardList,
    badgeClass: "bg-error-muted text-error",
  },
  other: {
    label: "Other",
    icon: Package,
    badgeClass: "bg-surface-muted text-muted-foreground",
  },
};

export const ALL_RESOURCE_TYPES: ResourceType[] = [
  "book",
  "short_note",
  "extra_note",
  "questions",
  "past_paper",
  "important_questions",
  "practical",
  "revision_note",
  "other",
];

export function resourceTypeLabel(type: ResourceType): string {
  return RESOURCE_TYPE_CONFIG[type].label;
}
