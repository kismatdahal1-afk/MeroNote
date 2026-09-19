import type { Request, Response } from "express";
import { Bookmark, Resource, Subject } from "../models";
import { liveFilter, liveResourceFilter } from "../repositories";
import { detailEnvelope, listEnvelope, parseObjectId, parsePagination } from "../lib/api";
import { attachTargets } from "../lib/targets";

type TargetType = "resource" | "subject";

function isTargetType(value: unknown): value is TargetType {
  return value === "resource" || value === "subject";
}

async function targetIsLive(targetType: string, targetId: string): Promise<boolean> {
  if (targetType === "resource") {
    return (await Resource.exists({ _id: targetId, ...liveResourceFilter() })) !== null;
  }
  return (await Subject.exists({ _id: targetId, ...liveFilter() })) !== null;
}

function readBody(req: Request): { targetType: unknown; targetId: unknown; page: unknown; note: unknown } {
  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as Record<string, unknown>;
  return { targetType: body.targetType, targetId: body.targetId, page: body.page, note: body.note };
}

export async function listBookmarks(req: Request, res: Response): Promise<void> {
  const pagination = parsePagination(req.query);
  if ("error" in pagination) {
    res.status(400).json({ status: "error", message: pagination.error });
    return;
  }
  const { page, limit } = pagination;
  const filter = { userId: req.user!.id };
  const [total, rows] = await Promise.all([
    Bookmark.countDocuments(filter).exec(),
    Bookmark.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
  ]);
  res.json(listEnvelope(await attachTargets(rows), page, limit, total));
}

/** Idempotent create: 201 first time, 200 with the existing row on retry. */
export async function createBookmark(req: Request, res: Response): Promise<void> {
  const { targetType, targetId: rawId, page, note } = readBody(req);
  if (!isTargetType(targetType)) {
    res.status(400).json({ status: "error", message: "Field 'targetType' must be 'resource' or 'subject'." });
    return;
  }
  const targetId = parseObjectId(rawId);
  if (!targetId) {
    res.status(400).json({ status: "error", message: "Field 'targetId' must be a valid id." });
    return;
  }
  if (!(await targetIsLive(targetType, targetId))) {
    res.status(404).json({ status: "error", message: "Target not found." });
    return;
  }

  let pageValue: number | undefined;
  if (targetType === "resource") {
    if (page !== undefined) {
      if (typeof page !== "number" || !Number.isInteger(page) || page < 1) {
        res.status(400).json({ status: "error", message: "Field 'page' must be a positive integer." });
        return;
      }
      pageValue = page;
    } else {
      pageValue = 1;
    }
    const resource = await Resource.findById(targetId).select("pageCount").lean().exec();
    if (!resource || resource.pageCount === undefined) {
      res.status(400).json({ status: "error", message: "Resource has no readable file yet." });
      return;
    }
    if (pageValue > resource.pageCount) {
      res.status(400).json({ status: "error", message: `Field 'page' must not exceed ${resource.pageCount}.` });
      return;
    }
  } else if (page !== undefined) {
    res.status(400).json({ status: "error", message: "Field 'page' is only allowed for resource bookmarks." });
    return;
  }

  let noteValue = "";
  if (note !== undefined) {
    if (typeof note !== "string" || note.length > 1000) {
      res.status(400).json({ status: "error", message: "Field 'note' must be a string up to 1000 characters." });
      return;
    }
    noteValue = note;
  }

  const existing = await Bookmark.findOne({ userId: req.user!.id, targetType, targetId }).exec();
  if (existing) {
    res.json(detailEnvelope(existing.toObject()));
    return;
  }
  try {
    const created = await Bookmark.create({ userId: req.user!.id, targetType, targetId, page: pageValue, note: noteValue });
    res.status(201).json(detailEnvelope(created.toObject()));
  } catch (err) {
    // Concurrent double-save: unique index won the race — return the winner.
    if ((err as { code?: number }).code === 11000) {
      const winner = await Bookmark.findOne({ userId: req.user!.id, targetType, targetId }).exec();
      if (winner) {
        res.json(detailEnvelope(winner.toObject()));
        return;
      }
    }
    throw err;
  }
}

export async function updateBookmark(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  if (!id) {
    res.status(400).json({ status: "error", message: "Invalid bookmark id." });
    return;
  }
  const bookmark = await Bookmark.findOne({ _id: id, userId: req.user!.id }).exec();
  if (!bookmark) {
    res.status(404).json({ status: "error", message: "Bookmark not found." });
    return;
  }
  const { page, note } = readBody(req);
  if (page !== undefined) {
    if (bookmark.targetType !== "resource") {
      res.status(400).json({ status: "error", message: "Field 'page' is only allowed for resource bookmarks." });
      return;
    }
    if (typeof page !== "number" || !Number.isInteger(page) || page < 1) {
      res.status(400).json({ status: "error", message: "Field 'page' must be a positive integer." });
      return;
    }
    const resource = await Resource.findById(bookmark.targetId).select("pageCount").lean().exec();
    if (!resource || resource.pageCount === undefined) {
      res.status(400).json({ status: "error", message: "Resource has no readable file yet." });
      return;
    }
    if (page > resource.pageCount) {
      res.status(400).json({ status: "error", message: `Field 'page' must not exceed ${resource.pageCount}.` });
      return;
    }
    bookmark.page = page;
  }
  if (note !== undefined) {
    if (typeof note !== "string" || note.length > 1000) {
      res.status(400).json({ status: "error", message: "Field 'note' must be a string up to 1000 characters." });
      return;
    }
    bookmark.note = note;
  }
  await bookmark.save();
  res.json(detailEnvelope(bookmark.toObject()));
}

export async function deleteBookmark(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  if (!id) {
    res.status(400).json({ status: "error", message: "Invalid bookmark id." });
    return;
  }
  const removed = await Bookmark.findOneAndDelete({ _id: id, userId: req.user!.id }).exec();
  if (!removed) {
    res.status(404).json({ status: "error", message: "Bookmark not found." });
    return;
  }
  res.json(detailEnvelope({ removed: true }));
}
