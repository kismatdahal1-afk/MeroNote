/**
 * Adapters from API-backed personal rows to the existing card/domain shapes.
 * Favorites/bookmarks/progress lists arrive with enriched `target` summaries
 * (see server attachTargets); these adapters build full Resource/Subject
 * objects so existing cards render unchanged. Missing targets (deleted
 * upstream) map to null and are filtered by callers.
 */

import type { Bookmark, ReadingProgress, Resource, Subject } from "../types";
import type { StudyBookmarkRow, StudyFavoriteRow, StudyProgressRow } from "./studyApi";

interface TargetSummary {
  title?: string;
  name?: string;
  code?: string;
  description?: string;
  category?: string;
  type?: string;
  tags?: string[];
  pageCount?: number;
  fileSize?: number;
  subjectId?: string;
  semesterId?: string;
  subjectName?: string;
  semesterName?: string;
}

type RowWithTarget = { targetId: string; targetType?: string; target?: TargetSummary | null };

function asTarget(row: RowWithTarget): (TargetSummary & { id: string }) | null {
  if (!row.target) return null;
  return { ...row.target, id: String(row.targetId) };
}

const RESOURCE_TYPES = [
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

export function targetToResource(targetId: string, target: TargetSummary & { id: string }): Resource {
  const type = (RESOURCE_TYPES as readonly string[]).includes(target.type ?? "")
    ? (target.type as Resource["type"])
    : "custom";
  return {
    id: String(targetId),
    title: target.title ?? "Untitled resource",
    description: target.description ?? "",
    semesterId: target.semesterId ?? "",
    subjectId: target.subjectId ?? "",
    topicId: undefined,
    type,
    customType: undefined,
    fileName: "",
    fileSize: target.fileSize ?? 0,
    pageCount: target.pageCount ?? 1,
    tags: target.tags ?? [],
    uploadedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    bookId: undefined,
    featured: false,
    paperYear: undefined,
    paperFullMarks: undefined,
    paperDurationMinutes: undefined,
    status: "published",
    hidden: false,
  };
}

export function targetToSubject(targetId: string, target: TargetSummary & { id: string }): Subject {
  const category = target.category === "elective" || target.category === "practical" ? target.category : "core";
  return {
    id: String(targetId),
    semesterId: target.semesterId ?? "",
    name: target.name ?? "Untitled subject",
    code: target.code ?? "",
    description: target.description ?? "",
    category,
    credits: 0,
    offlineSync: 0,
    hotTopics: [],
    fullMarks: undefined,
    status: "published",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

export function favoriteRowToResource(row: StudyFavoriteRow & RowWithTarget): Resource | null {
  if (row.targetType !== "resource") return null;
  const target = asTarget(row);
  if (!target) return null;
  return targetToResource(row.targetId, target);
}

export function favoriteRowToSubject(row: StudyFavoriteRow & RowWithTarget): Subject | null {
  if (row.targetType !== "subject") return null;
  const target = asTarget(row);
  if (!target) return null;
  return targetToSubject(row.targetId, target);
}

export function bookmarkRowToBookmark(row: StudyBookmarkRow): Bookmark | null {
  if (row.targetType !== "resource") return null;
  return {
    id: String(row._id ?? row.targetId),
    resourceId: String(row.targetId),
    page: typeof row.page === "number" && row.page > 0 ? Math.floor(row.page) : 1,
    note: typeof row.note === "string" ? row.note : "",
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
  };
}

export function bookmarkRowToSubject(row: StudyBookmarkRow & RowWithTarget): Subject | null {
  if (row.targetType !== "subject") return null;
  const target = asTarget(row);
  if (!target) return null;
  return targetToSubject(row.targetId, target);
}

export function progressRowToProgress(row: StudyProgressRow): ReadingProgress {
  return {
    resourceId: String(row.resourceId),
    lastPage: row.lastPage,
    progress: row.progress,
    updatedAt: row.updatedAt,
  };
}
