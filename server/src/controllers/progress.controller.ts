import type { Request, Response } from "express";
import { ReadingProgress, Resource } from "../models";
import { liveResourceFilter } from "../repositories";
import { detailEnvelope, listEnvelope, parseObjectId, parsePagination } from "../lib/api";

export async function listProgress(req: Request, res: Response): Promise<void> {
  const pagination = parsePagination(req.query);
  if ("error" in pagination) {
    res.status(400).json({ status: "error", message: pagination.error });
    return;
  }
  const { page, limit } = pagination;
  const filter = { userId: req.user!.id };
  const [total, rows] = await Promise.all([
    ReadingProgress.countDocuments(filter).exec(),
    ReadingProgress.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("resourceId", "title description type tags pageCount fileSize subjectId semesterId")
      .lean()
      .exec(),
  ]);
  res.json(listEnvelope(rows, page, limit, total));
}

export async function getProgress(req: Request, res: Response): Promise<void> {
  const resourceId = parseObjectId(req.params.resourceId);
  if (!resourceId) {
    res.status(400).json({ status: "error", message: "Invalid resource id." });
    return;
  }
  const row = await ReadingProgress.findOne({ userId: req.user!.id, resourceId }).lean().exec();
  if (!row) {
    res.status(404).json({ status: "error", message: "No reading progress for this resource." });
    return;
  }
  res.json(detailEnvelope(row));
}

/**
 * Atomic upsert: at most one row per (userId, resourceId).
 * The client sends { lastPage } only — progress is computed server-side
 * from the resource's real pageCount; client fractions are never trusted.
 */
export async function putProgress(req: Request, res: Response): Promise<void> {
  const resourceId = parseObjectId(req.params.resourceId);
  if (!resourceId) {
    res.status(400).json({ status: "error", message: "Invalid resource id." });
    return;
  }
  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as Record<string, unknown>;
  const { lastPage } = body;
  if (typeof lastPage !== "number" || !Number.isInteger(lastPage) || lastPage < 1) {
    res.status(400).json({ status: "error", message: "Field 'lastPage' must be a positive integer." });
    return;
  }
  const resource = await Resource.findOne({ _id: resourceId, ...liveResourceFilter() }).select("pageCount").lean().exec();
  if (!resource) {
    res.status(404).json({ status: "error", message: "Resource not found." });
    return;
  }
  if (resource.pageCount === undefined) {
    res.status(400).json({ status: "error", message: "Resource has no readable file yet." });
    return;
  }
  if (lastPage > resource.pageCount) {
    res.status(400).json({ status: "error", message: `Field 'lastPage' must not exceed ${resource.pageCount}.` });
    return;
  }
  const row = await ReadingProgress.findOneAndUpdate(
    { userId: req.user!.id, resourceId },
    { $set: { lastPage, progress: Math.min(1, lastPage / resource.pageCount) } },
    { upsert: true, returnDocument: "after" },
  ).exec();
  if (!row) throw new Error("Progress upsert unexpectedly returned no document.");
  res.json(detailEnvelope(row.toObject()));
}
