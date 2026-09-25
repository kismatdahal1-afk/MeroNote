/**
 * Shared enum constants — mirrors client/src/types/index.ts.
 * Single source for Mongoose `enum` validators (Phase 1).
 */

export const RESOURCE_TYPES = [
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
] as const;

export const PUBLISH_STATUSES = ["draft", "published", "hidden"] as const;

export const NOTICE_STATUSES = ["draft", "published"] as const;

export const NOTICE_TYPES = [
  "exam",
  "deadline",
  "assignment",
  "event",
  "important",
  "announcement",
  "reminder",
  "general",
] as const;

export const NOTICE_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const NOTICE_ANNOUNCERS = [
  "administration",
  "csit-department",
  "examination",
  "library",
] as const;

export const SUBJECT_CATEGORIES = ["core", "elective", "practical"] as const;

export const USER_ROLES = ["USER", "ADMIN"] as const;

/** User-specific semester plan status (Phase 16). Mirrors the existing
 *  frontend SemesterUserStatus terminology: upcoming | ongoing | passed. */
export const SEMESTER_USER_STATUSES = ["upcoming", "ongoing", "passed"] as const;

export const FAVORITE_TARGETS = ["resource", "subject"] as const;

export const ALLOWED_MIME_TYPES = ["application/pdf"] as const;
