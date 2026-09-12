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
  /** badge classes for light + dark */
  badgeClass: string;
}

export const RESOURCE_TYPE_CONFIG: Record<ResourceType, ResourceTypeConfig> = {
  book: {
    label: "Book",
    icon: BookOpen,
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  short_note: {
    label: "Short Note",
    icon: FileText,
    badgeClass: "bg-sky-500/10 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  },
  extra_note: {
    label: "Extra Note",
    icon: Layers,
    badgeClass: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300",
  },
  questions: {
    label: "Questions",
    icon: HelpCircle,
    badgeClass: "bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  },
  past_paper: {
    label: "Past Paper",
    icon: FileArchive,
    badgeClass: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  },
  important_questions: {
    label: "Important Questions",
    icon: Sparkles,
    badgeClass: "bg-fuchsia-500/10 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
  },
  practical: {
    label: "Practical/Lab",
    icon: FlaskConical,
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  revision_note: {
    label: "Revision Note",
    icon: ClipboardList,
    badgeClass: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  },
  other: {
    label: "Other",
    icon: Package,
    badgeClass: "bg-slate-500/10 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
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
