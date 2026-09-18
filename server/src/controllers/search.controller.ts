import type { Request, Response } from "express";
import type { Types } from "mongoose";
import {
  Book,
  Notice,
  Resource,
  Semester,
  Subject,
  Topic,
  RESOURCE_TYPES,
} from "../models";
import { liveFilter, liveResourceFilter } from "../repositories";
import { listEnvelope, parseObjectId, parsePagination } from "../lib/api";

/**
 * Phase 10 unified search: GET /api/search (public, read-only).
 *
 * One bounded $text query per entity collection (each has exactly one
 * compound text index), merged by textScore with a stable _id tiebreak,
 * then sliced to the requested page. Totals are exact per-entity counts.
 * Visibility uses the same liveFilter()/liveResourceFilter() helpers as the
 * Phase 4 endpoints, so drafts/hidden/deleted rows can never match.
 *
 * Notes:
 * - `$text` lives inside `Record<string, unknown>` filters, exactly like the
 *   Phase 4 controllers pass theirs — no `any`, no casts for the query.
 *   The `$meta` score projection needs one narrow per-entity cast each
 *   (the projected `score` field is invisible to lean typings).
 * - Cross-collection textScores are not directly comparable; ordering is
 *   deterministic (score desc, _id asc) rather than a relevance claim.
 */

export const SEARCH_ENTITIES = ["semester", "subject", "topic", "resource", "book", "notice"] as const;
export type SearchEntityType = (typeof SEARCH_ENTITIES)[number];

const RESOURCE_TYPE_SET = new Set<string>(RESOURCE_TYPES as readonly string[]);

const MAX_QUERY_LENGTH = 100;
/** Per-entity fan-out cap: keeps the merge bounded (documented, Step 12). */
const PER_ENTITY_CAP = 200;

export interface SearchRow {
  entityType: SearchEntityType;
  id: string;
  title: string;
  description: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface Scored {
  _id: Types.ObjectId;
  score: number;
}

function isSearchEntity(value: unknown): value is SearchEntityType {
  return typeof value === "string" && (SEARCH_ENTITIES as readonly string[]).includes(value);
}

function normalizeQuery(raw: unknown): { q: string } | { error: string } {
  if (typeof raw !== "string") return { error: "Query 'q' is required." };
  const q = raw.trim().replace(/\s+/g, " ");
  if (!q) return { error: "Query 'q' is required." };
  if (q.length > MAX_QUERY_LENGTH) {
    return { error: `Query 'q' must be at most ${MAX_QUERY_LENGTH} characters.` };
  }
  return { q };
}

/** Escape for the semester-name substring fallback (never raw user regex). */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface SearchFilters {
  entityType?: SearchEntityType;
  type?: string;
  tag?: string;
  semesterId?: string;
  subjectId?: string;
}

function parseFilters(query: Record<string, unknown>): { filters: SearchFilters } | { error: string } {
  const filters: SearchFilters = {};
  if (query.entityType !== undefined) {
    if (!isSearchEntity(query.entityType)) {
      return { error: `Query 'entityType' must be one of: ${SEARCH_ENTITIES.join(", ")}.` };
    }
    filters.entityType = query.entityType;
  }
  if (query.type !== undefined) {
    if (typeof query.type !== "string" || !RESOURCE_TYPE_SET.has(query.type)) {
      return { error: `Query 'type' must be one of: ${(RESOURCE_TYPES as readonly string[]).join(", ")}.` };
    }
    filters.type = query.type;
  }
  if (query.tag !== undefined) {
    if (typeof query.tag !== "string" || !query.tag.trim()) {
      return { error: "Query 'tag' must be a non-empty string." };
    }
    filters.tag = query.tag.trim().toLowerCase();
  }
  for (const key of ["semesterId", "subjectId"] as const) {
    if (query[key] === undefined) continue;
    const id = parseObjectId(query[key]);
    if (!id) return { error: `Query '${key}' must be a valid id.` };
    filters[key] = id;
  }
  return { filters };
}

function wants(entity: SearchEntityType, only?: SearchEntityType): boolean {
  return !only || only === entity;
}

export async function searchContent(req: Request, res: Response): Promise<void> {
  const normalized = normalizeQuery((req.query as Record<string, unknown>).q);
  if ("error" in normalized) {
    res.status(400).json({ status: "error", message: normalized.error });
    return;
  }
  const parsedFilters = parseFilters(req.query as Record<string, unknown>);
  if ("error" in parsedFilters) {
    res.status(400).json({ status: "error", message: parsedFilters.error });
    return;
  }
  const pagination = parsePagination(req.query);
  if ("error" in pagination) {
    res.status(400).json({ status: "error", message: pagination.error });
    return;
  }
  const { q } = normalized;
  const { filters } = parsedFilters;
  const { page, limit } = pagination;
  const perEntityLimit = Math.min(page * limit, PER_ENTITY_CAP);
  const only = filters.entityType;

  // Entity searches are independent: fan out in parallel, then merge.
  const tasks: Array<Promise<{ rows: SearchRow[]; total: number }>> = [];

  if (wants("resource", only)) {
    tasks.push((async () => {
      const filter: Record<string, unknown> = { ...liveResourceFilter(), $text: { $search: q } };
      if (filters.semesterId) filter.semesterId = filters.semesterId;
      if (filters.subjectId) filter.subjectId = filters.subjectId;
      if (filters.type) filter.type = filters.type;
      if (filters.tag) filter.tags = filters.tag;
      const [total, docs] = await Promise.all([
        Resource.countDocuments(filter).exec(),
        Resource.find(filter, { score: { $meta: "textScore" } })
          .sort({ score: { $meta: "textScore" }, _id: 1 })
          .limit(perEntityLimit)
          .lean()
          .exec(),
      ]);
      const rows = (docs as Array<(typeof docs)[number] & Scored>).map((r) => ({
        entityType: "resource" as const,
        id: String(r._id),
        title: r.title,
        description: r.description ?? "",
        score: r.score,
        metadata: {
          type: r.type,
          tags: r.tags,
          subjectId: String(r.subjectId),
          topicId: r.topicId ? String(r.topicId) : undefined,
          bookId: r.bookId ? String(r.bookId) : undefined,
          fileSize: r.fileSize,
          pageCount: r.pageCount,
        },
      }));
      return { rows, total };
    })());
  }

  if (wants("subject", only)) {
    tasks.push((async () => {
      const filter: Record<string, unknown> = { ...liveFilter(), $text: { $search: q } };
      if (filters.semesterId) filter.semesterId = filters.semesterId;
      const [total, docs] = await Promise.all([
        Subject.countDocuments(filter).exec(),
        Subject.find(filter, { score: { $meta: "textScore" } })
          .sort({ score: { $meta: "textScore" }, _id: 1 })
          .limit(perEntityLimit)
          .lean()
          .exec(),
      ]);
      const rows = (docs as Array<(typeof docs)[number] & Scored>).map((r) => ({
        entityType: "subject" as const,
        id: String(r._id),
        title: r.name,
        description: r.description ?? "",
        score: r.score,
        metadata: { code: r.code, category: r.category, semesterId: String(r.semesterId) },
      }));
      return { rows, total };
    })());
  }

  if (wants("topic", only)) {
    tasks.push((async () => {
      const filter: Record<string, unknown> = { ...liveFilter(), $text: { $search: q } };
      if (filters.subjectId) filter.subjectId = filters.subjectId;
      const [total, docs] = await Promise.all([
        Topic.countDocuments(filter).exec(),
        Topic.find(filter, { score: { $meta: "textScore" } })
          .sort({ score: { $meta: "textScore" }, _id: 1 })
          .limit(perEntityLimit)
          .lean()
          .exec(),
      ]);
      const rows = (docs as Array<(typeof docs)[number] & Scored>).map((r) => ({
        entityType: "topic" as const,
        id: String(r._id),
        title: r.title,
        description: r.description ?? "",
        score: r.score,
        metadata: { order: r.order, subjectId: String(r.subjectId) },
      }));
      return { rows, total };
    })());
  }

  if (wants("book", only)) {
    tasks.push((async () => {
      const filter: Record<string, unknown> = { ...liveFilter(), $text: { $search: q } };
      if (filters.semesterId) filter.semesterId = filters.semesterId;
      if (filters.subjectId) filter.subjectId = filters.subjectId;
      const [total, docs] = await Promise.all([
        Book.countDocuments(filter).exec(),
        Book.find(filter, { score: { $meta: "textScore" } })
          .sort({ score: { $meta: "textScore" }, _id: 1 })
          .limit(perEntityLimit)
          .lean()
          .exec(),
      ]);
      const rows = (docs as Array<(typeof docs)[number] & Scored>).map((r) => ({
        entityType: "book" as const,
        id: String(r._id),
        title: r.title,
        description: r.description ?? "",
        score: r.score,
        metadata: { author: r.author, semesterId: String(r.semesterId), subjectId: String(r.subjectId) },
      }));
      return { rows, total };
    })());
  }

  if (wants("notice", only)) {
    tasks.push((async () => {
      const filter: Record<string, unknown> = { status: "published", deletedAt: null, $text: { $search: q } };
      const [total, docs] = await Promise.all([
        Notice.countDocuments(filter).exec(),
        Notice.find(filter, { score: { $meta: "textScore" } })
          .sort({ score: { $meta: "textScore" }, _id: 1 })
          .limit(perEntityLimit)
          .lean()
          .exec(),
      ]);
      const rows = (docs as Array<(typeof docs)[number] & Scored>).map((r) => ({
        entityType: "notice" as const,
        id: String(r._id),
        title: r.heading,
        description: r.subtext ?? "",
        score: r.score,
        metadata: { type: r.type, date: r.date, priority: r.priority },
      }));
      return { rows, total };
    })());
  }

  if (wants("semester", only)) {
    tasks.push((async () => {
      // Small collection (8 docs): exact number match + escaped name/description substring. No text index needed.
      const numeric = /^\d+$/.test(q) ? Number(q) : null;
      const or: Record<string, unknown>[] = [];
      if (numeric !== null && numeric >= 1 && numeric <= 99) or.push({ number: numeric });
      const safe = escapeRegExp(q);
      or.push({ name: { $regex: safe, $options: "i" } });
      or.push({ description: { $regex: safe, $options: "i" } });
      const base = { ...liveFilter(), $or: or };
      const [total, docs] = await Promise.all([
        Semester.countDocuments(base).exec(),
        Semester.find(base).sort({ order: 1 }).limit(perEntityLimit).lean().exec(),
      ]);
      const rows = docs.map((r) => ({
        entityType: "semester" as const,
        id: String(r._id),
        title: r.name,
        description: r.description ?? "",
        score: 1,
        metadata: { number: r.number },
      }));
      return { rows, total };
    })());
  }

  const groups = await Promise.all(tasks);

  // Relationship enrichment, batched (no N+1): one $in query per entity kind.
  const subjectIds = new Set<string>();
  const semesterIds = new Set<string>();
  const topicIds = new Set<string>();
  const bookIds = new Set<string>();
  for (const group of groups) {
    for (const row of group.rows) {
      const meta = row.metadata as Record<string, string | undefined>;
      if (typeof meta.subjectId === "string") subjectIds.add(meta.subjectId);
      if (typeof meta.semesterId === "string") semesterIds.add(meta.semesterId);
      if (typeof meta.topicId === "string") topicIds.add(meta.topicId);
      if (typeof meta.bookId === "string") bookIds.add(meta.bookId);
    }
  }
  const [subjects, semesters, topics, books] = await Promise.all([
    subjectIds.size > 0 ? Subject.find({ _id: { $in: [...subjectIds] } }).select("name code semesterId").lean().exec() : [],
    semesterIds.size > 0 ? Semester.find({ _id: { $in: [...semesterIds] } }).select("name number").lean().exec() : [],
    topicIds.size > 0 ? Topic.find({ _id: { $in: [...topicIds] } }).select("title").lean().exec() : [],
    bookIds.size > 0 ? Book.find({ _id: { $in: [...bookIds] } }).select("title").lean().exec() : [],
  ]);
  const subjectById = new Map(subjects.map((s) => [String(s._id), s]));
  const semesterById = new Map(semesters.map((s) => [String(s._id), s]));
  const topicById = new Map(topics.map((t) => [String(t._id), t]));
  const bookById = new Map(books.map((b) => [String(b._id), b]));
  for (const group of groups) {
    for (const row of group.rows) {
      const meta = row.metadata as Record<string, unknown>;
      if (typeof meta.subjectId === "string") {
        const s = subjectById.get(meta.subjectId);
        if (s) {
          meta.subjectName = s.name;
          meta.subjectCode = s.code;
          if (typeof meta.semesterId !== "string") meta.semesterId = String(s.semesterId);
        }
      }
      if (typeof meta.semesterId === "string") {
        const s = semesterById.get(meta.semesterId);
        if (s) {
          meta.semesterName = s.name;
          meta.semesterNumber = s.number;
        }
      }
      if (typeof meta.topicId === "string") {
        const t = topicById.get(meta.topicId);
        if (t) meta.topicTitle = t.title;
      }
      if (typeof meta.bookId === "string") {
        const b = bookById.get(meta.bookId);
        if (b) meta.bookTitle = b.title;
      }
      // Reference ids stay in metadata: clients need them for navigation
      // (topic/book → parent subject) and follow-up filtering.
    }
  }

  const merged = groups
    .flatMap((group) => group.rows)
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  const pageWindow = merged.slice((page - 1) * limit, page * limit);
  // Scores are internal ranking signals, not part of the public contract.
  const data = pageWindow.map(({ score: _score, ...rest }) => rest);
  res.json(listEnvelope(data, page, limit, total));
}
