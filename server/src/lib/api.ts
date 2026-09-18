import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";

/**
 * Shared Phase 4 API plumbing: consistent envelope, pagination, and
 * allowlisted input parsing. Unknown query params are ignored (never passed
 * to MongoDB), so arbitrary query operators cannot reach the database.
 */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function listEnvelope<T>(data: T[], page: number, limit: number, total: number): {
  status: string;
  data: T[];
  pagination: Pagination;
} {
  return {
    status: "ok",
    data,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export function detailEnvelope<T>(data: T): { status: string; data: T } {
  return { status: "ok", data };
}

export function parsePagination(query: unknown): { page: number; limit: number } | { error: string } {
  const q = (typeof query === "object" && query !== null ? query : {}) as Record<string, unknown>;
  const rawPage = q.page === undefined ? "1" : String(q.page);
  const rawLimit = q.limit === undefined ? String(DEFAULT_LIMIT) : String(q.limit);
  const page = Number(rawPage);
  const limit = Number(rawLimit);
  if (!Number.isInteger(page) || page < 1) return { error: "Query 'page' must be a positive integer." };
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { error: `Query 'limit' must be an integer between 1 and ${MAX_LIMIT}.` };
  }
  return { page, limit };
}

/** Valid ObjectId string or null (invalid → caller sends 400). */
export function parseObjectId(value: unknown): string | null {
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) return null;
  return value;
}

/** Optional boolean query flag ("true"/"1" only — everything else false). */
export function parseFlag(value: unknown): boolean {
  return value === "true" || value === "1";
}

/** Express 4 does not forward async rejections — wrap every async handler. */
export function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}
