import type { Types } from "mongoose";
import { Resource, Semester, Subject } from "../models";

/**
 * Batch-enrich unified target rows (favorites/bookmarks reference resources
 * or subjects through a bare `targetId` with no schema `ref`, so Mongoose
 * populate() silently no-ops on them — verified by probe).
 * Returns rows untouched except for an added `target` summary (null when the
 * target was deleted after saving).
 */

export interface TargetSummary {
  _id: unknown;
  title?: string;
  name?: string;
  code?: string;
  description?: string;
  category?: string;
  type?: string;
  tags?: string[];
  pageCount?: number;
  fileSize?: number;
  subjectId?: unknown;
  semesterId?: unknown;
  subjectName?: string;
  semesterName?: string;
}

interface TargetRow {
  targetType: string;
  targetId: Types.ObjectId | string;
}

export async function attachTargets<T extends TargetRow>(rows: T[]): Promise<Array<T & { target: TargetSummary | null }>> {
  const resourceIds = rows.filter((r) => r.targetType === "resource").map((r) => r.targetId);
  const subjectIds = rows.filter((r) => r.targetType === "subject").map((r) => r.targetId);
  const [resources, subjects] = await Promise.all([
    resourceIds.length > 0
      ? Resource.find({ _id: { $in: resourceIds } })
          .select("title description type tags pageCount fileSize subjectId semesterId")
          .lean()
          .exec()
      : [],
    subjectIds.length > 0
      ? Subject.find({ _id: { $in: subjectIds } })
          .select("name code description category semesterId")
          .lean()
          .exec()
      : [],
  ]);
  // Semester names for context lines (one extra bounded query, no N+1).
  const semesterIds = new Set<string>();
  const resourceSubjectIds = new Set<string>();
  for (const r of resources) {
    semesterIds.add(String(r.semesterId));
    resourceSubjectIds.add(String(r.subjectId));
  }
  for (const s of subjects) semesterIds.add(String(s.semesterId));
  const [semesters, resourceSubjects] = await Promise.all([
    semesterIds.size > 0
      ? Semester.find({ _id: { $in: [...semesterIds] } })
          .select("name")
          .lean()
          .exec()
      : [],
    resourceSubjectIds.size > 0
      ? Subject.find({ _id: { $in: [...resourceSubjectIds] } })
          .select("name")
          .lean()
          .exec()
      : [],
  ]);
  const semesterNames = new Map(semesters.map((s) => [String(s._id), s.name]));
  const resourceSubjectNames = new Map(resourceSubjects.map((s) => [String(s._id), s.name]));
  const byId = new Map<string, TargetSummary>();
  for (const r of resources) {
    const subjectName = resourceSubjectNames.get(String(r.subjectId));
    const semesterName = semesterNames.get(String(r.semesterId));
    byId.set(String(r._id), {
      _id: r._id,
      title: r.title,
      description: r.description,
      type: r.type,
      tags: r.tags,
      pageCount: r.pageCount,
      fileSize: r.fileSize,
      subjectId: r.subjectId,
      semesterId: r.semesterId,
      ...(subjectName ? { subjectName } : {}),
      ...(semesterName ? { semesterName } : {}),
    });
  }
  for (const s of subjects) {
    const semesterName = semesterNames.get(String(s.semesterId));
    byId.set(String(s._id), {
      _id: s._id,
      name: s.name,
      code: s.code,
      description: s.description,
      category: s.category,
      semesterId: s.semesterId,
      ...(semesterName ? { semesterName } : {}),
    });
  }
  return rows.map((row) => ({ ...row, target: byId.get(String(row.targetId)) ?? null }));
}
