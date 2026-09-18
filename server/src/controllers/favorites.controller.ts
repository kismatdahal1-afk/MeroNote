import type { Request, Response } from "express";
import { Favorite, Resource, Subject, FAVORITE_TARGETS } from "../models";
import { liveFilter, liveResourceFilter } from "../repositories";
import { detailEnvelope, listEnvelope, parseObjectId, parsePagination } from "../lib/api";
import { attachTargets } from "../lib/targets";

const TARGET_VALUES = FAVORITE_TARGETS as readonly string[];

type TargetType = "resource" | "subject";

function isTargetType(value: unknown): value is TargetType {
  return value === "resource" || value === "subject";
}

/** Confirm the target exists AND is visible to students. */
async function targetIsLive(targetType: string, targetId: string): Promise<boolean> {
  if (targetType === "resource") {
    return (await Resource.exists({ _id: targetId, ...liveResourceFilter() })) !== null;
  }
  return (await Subject.exists({ _id: targetId, ...liveFilter() })) !== null;
}

function parseTarget(req: Request): { targetType: TargetType; targetId: string } | { error: string } {
  const { targetType, targetId } = req.params;
  if (!isTargetType(targetType)) {
    return { error: `Param 'targetType' must be one of: ${TARGET_VALUES.join(", ")}.` };
  }
  const id = parseObjectId(targetId);
  if (!id) return { error: "Param 'targetId' must be a valid id." };
  return { targetType, targetId: id };
}

export async function listFavorites(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const filter: Record<string, unknown> = { userId };
  const rawType = (req.query as Record<string, unknown>).targetType;
  if (rawType !== undefined) {
    if (!isTargetType(rawType)) {
      res.status(400).json({ status: "error", message: "Query 'targetType' must be 'resource' or 'subject'." });
      return;
    }
    filter.targetType = rawType;
  }
  const pagination = parsePagination(req.query);
  if ("error" in pagination) {
    res.status(400).json({ status: "error", message: pagination.error });
    return;
  }
  const { page, limit } = pagination;
  const [total, rows] = await Promise.all([
    Favorite.countDocuments(filter).exec(),
    Favorite.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
  ]);
  res.json(listEnvelope(await attachTargets(rows), page, limit, total));
}

/** Idempotent save: 201 on first save, 200 when already saved. */
export async function putFavorite(req: Request, res: Response): Promise<void> {
  const parsed = parseTarget(req);
  if ("error" in parsed) {
    res.status(400).json({ status: "error", message: parsed.error });
    return;
  }
  const { targetType, targetId } = parsed;
  if (!(await targetIsLive(targetType, targetId))) {
    res.status(404).json({ status: "error", message: "Target not found." });
    return;
  }
  const existing = await Favorite.findOne({ userId: req.user!.id, targetType, targetId }).exec();
  if (existing) {
    res.json(detailEnvelope(existing.toObject()));
    return;
  }
  try {
    const created = await Favorite.create({ userId: req.user!.id, targetType, targetId });
    res.status(201).json(detailEnvelope(created.toObject()));
  } catch (err) {
    // Concurrent double-save: unique index won the race — return the winner.
    if ((err as { code?: number }).code === 11000) {
      const winner = await Favorite.findOne({ userId: req.user!.id, targetType, targetId }).exec();
      if (winner) {
        res.json(detailEnvelope(winner.toObject()));
        return;
      }
    }
    throw err;
  }
}

/** Idempotent removal scoped to the caller: always 200. */
export async function deleteFavorite(req: Request, res: Response): Promise<void> {
  const parsed = parseTarget(req);
  if ("error" in parsed) {
    res.status(400).json({ status: "error", message: parsed.error });
    return;
  }
  const { targetType, targetId } = parsed;
  const removed = await Favorite.findOneAndDelete({ userId: req.user!.id, targetType, targetId }).exec();
  res.json(detailEnvelope({ removed: removed !== null }));
}
