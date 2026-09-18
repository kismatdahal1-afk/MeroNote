import type { Request, Response } from "express";
import { Book, Resource } from "../models";
import { liveFilter, liveResourceFilter } from "../repositories";
import { detailEnvelope, listEnvelope, parseObjectId, parsePagination } from "../lib/api";

export async function listBooks(req: Request, res: Response): Promise<void> {
  const filter: Record<string, unknown> = { ...liveFilter() };
  for (const key of ["semesterId", "subjectId"] as const) {
    const raw = (req.query as Record<string, unknown>)[key];
    if (raw === undefined) continue;
    const id = parseObjectId(raw);
    if (!id) {
      res.status(400).json({ status: "error", message: `Query '${key}' must be a valid id.` });
      return;
    }
    filter[key] = id;
  }
  const pagination = parsePagination(req.query);
  if ("error" in pagination) {
    res.status(400).json({ status: "error", message: pagination.error });
    return;
  }
  const { page, limit } = pagination;
  const [total, rows] = await Promise.all([
    Book.countDocuments(filter).exec(),
    Book.find(filter).sort({ title: 1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
  ]);
  res.json(listEnvelope(rows, page, limit, total));
}

export async function getBook(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  if (!id) {
    res.status(400).json({ status: "error", message: "Invalid book id." });
    return;
  }
  const book = await Book.findOne({ _id: id, ...liveFilter() }).lean().exec();
  if (!book) {
    res.status(404).json({ status: "error", message: "Book not found." });
    return;
  }
  // One-way link resolved from the resource side (no Book.resourceId exists).
  const resources = await Resource.find({ bookId: id, ...liveResourceFilter() }).sort({ uploadedAt: -1 }).lean().exec();
  res.json(detailEnvelope({ ...book, resources }));
}
