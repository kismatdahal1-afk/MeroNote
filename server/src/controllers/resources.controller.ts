import type { Request, Response } from "express";
import { Resource, RESOURCE_TYPES } from "../models";
import { liveResourceFilter } from "../repositories";
import { detailEnvelope, listEnvelope, parseFlag, parseObjectId, parsePagination } from "../lib/api";

const RESOURCE_TYPE_SET = new Set<string>(RESOURCE_TYPES as readonly string[]);

function resourceFilters(query: Record<string, unknown>): { filter: Record<string, unknown> } | { error: string } {
  const filter: Record<string, unknown> = { ...liveResourceFilter() };

  for (const key of ["semesterId", "subjectId", "topicId"] as const) {
    if (query[key] === undefined) continue;
    const id = parseObjectId(query[key]);
    if (!id) return { error: `Query '${key}' must be a valid id.` };
    filter[key] = id;
  }

  if (query.type !== undefined) {
    if (typeof query.type !== "string" || !RESOURCE_TYPE_SET.has(query.type)) {
      return { error: `Query 'type' must be one of: ${(RESOURCE_TYPES as readonly string[]).join(", ")}.` };
    }
    filter.type = query.type;
  }

  if (query.tag !== undefined) {
    if (typeof query.tag !== "string" || !query.tag.trim()) {
      return { error: "Query 'tag' must be a non-empty string." };
    }
    // Tags are stored normalized (lowercase-trim); match the same way.
    filter.tags = query.tag.trim().toLowerCase();
  }

  if (query.featured !== undefined) {
    filter.featured = parseFlag(query.featured);
  }

  return { filter };
}

export async function listResources(req: Request, res: Response): Promise<void> {
  const parsed = resourceFilters(req.query as Record<string, unknown>);
  if ("error" in parsed) {
    res.status(400).json({ status: "error", message: parsed.error });
    return;
  }
  const pagination = parsePagination(req.query);
  if ("error" in pagination) {
    res.status(400).json({ status: "error", message: pagination.error });
    return;
  }
  const { page, limit } = pagination;
  const [total, rows] = await Promise.all([
    Resource.countDocuments(parsed.filter).exec(),
    Resource.find(parsed.filter).sort({ uploadedAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
  ]);
  res.json(listEnvelope(rows, page, limit, total));
}

export async function getResource(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  if (!id) {
    res.status(400).json({ status: "error", message: "Invalid resource id." });
    return;
  }
  const resource = await Resource.findOne({ _id: id, ...liveResourceFilter() })
    .populate("subjectId", "name code")
    .populate("topicId", "title")
    .populate("bookId", "title author")
    .lean()
    .exec();
  if (!resource) {
    res.status(404).json({ status: "error", message: "Resource not found." });
    return;
  }
  res.json(detailEnvelope(resource));
}
