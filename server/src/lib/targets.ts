import type { Types } from "mongoose";
import { Resource, Subject } from "../models";

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
}

interface TargetRow {
  targetType: string;
  targetId: Types.ObjectId | string;
}

export async function attachTargets<T extends TargetRow>(rows: T[]): Promise<Array<T & { target: TargetSummary | null }>> {
  const resourceIds = rows.filter((r) => r.targetType === "resource").map((r) => r.targetId);
  const subjectIds = rows.filter((r) => r.targetType === "subject").map((r) => r.targetId);
  const [resources, subjects] = await Promise.all([
    resourceIds.length > 0 ? Resource.find({ _id: { $in: resourceIds } }).select("title").lean().exec() : [],
    subjectIds.length > 0 ? Subject.find({ _id: { $in: subjectIds } }).select("name code").lean().exec() : [],
  ]);
  const byId = new Map<string, TargetSummary>();
  for (const r of resources) byId.set(String(r._id), { _id: r._id, title: r.title });
  for (const s of subjects) byId.set(String(s._id), { _id: s._id, name: s.name, code: s.code });
  return rows.map((row) => ({ ...row, target: byId.get(String(row.targetId)) ?? null }));
}
