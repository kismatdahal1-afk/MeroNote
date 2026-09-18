import type { Request, Response } from "express";
import { Notice } from "../models";
import { parseFlag, parseObjectId, parsePagination, detailEnvelope, listEnvelope } from "../lib/api";

const PUBLISHED_NOT_DELETED = { status: "published", deletedAt: null } as const;

export async function listNotices(req: Request, res: Response): Promise<void> {
  const pagination = parsePagination(req.query);
  if ("error" in pagination) {
    res.status(400).json({ status: "error", message: pagination.error });
    return;
  }
  const { page, limit } = pagination;
  const filter: Record<string, unknown> = { ...PUBLISHED_NOT_DELETED };
  if (parseFlag((req.query as Record<string, unknown>).dashboard)) {
    filter.showOnDashboard = true;
  }
  const [total, rows] = await Promise.all([
    Notice.countDocuments(filter).exec(),
    Notice.find(filter).sort({ pinned: -1, date: 1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
  ]);
  res.json(listEnvelope(rows, page, limit, total));
}

export async function getNotice(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  if (!id) {
    res.status(400).json({ status: "error", message: "Invalid notice id." });
    return;
  }
  const notice = await Notice.findOne({ _id: id, ...PUBLISHED_NOT_DELETED }).lean().exec();
  if (!notice) {
    res.status(404).json({ status: "error", message: "Notice not found." });
    return;
  }
  res.json(detailEnvelope(notice));
}
