/**
 * Typed client for the Phase 4 academic content API.
 * Mirrors authApi conventions: HttpOnly cookie via credentials:include,
 * existing {status,data,pagination} envelope, no token storage.
 * Backend `_id`s are mapped to the frontend's string `id` shapes.
 */

import type {
  Book,
  Notice,
  Resource,
  Semester,
  Subject,
  Topic,
} from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Envelope<T> {
  status: string;
  data: T;
  pagination?: Pagination;
  message?: string;
}

type RawDoc = Record<string, unknown> & { _id?: unknown; id?: string };

/** Backend `_id` (or pre-normalized `id`) → frontend string `id`. */
function withId(raw: RawDoc): Record<string, unknown> & { id: string } {
  const { _id, ...rest } = raw;
  const out: Record<string, unknown> = { ...rest };
  out.id = typeof _id === "string" || typeof _id === "number" ? String(_id) : String(rest.id ?? "");
  for (const key of ["semesterId", "subjectId", "topicId", "bookId", "resourceId", "userId"]) {
    out[key] = refId(out[key]);
  }
  return out as Record<string, unknown> & { id: string };
}

/** ObjectId string, populated doc, or nothing → stable string id or undefined. */
function refId(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record._id === "string" || typeof record._id === "number") return String(record._id);
    if (typeof record.id === "string") return record.id;
  }
  return undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<{ data: T; pagination: Pagination | null }> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: { "content-type": "application/json" },
      ...init,
      signal: init?.signal ?? null,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as Envelope<T>;
  if (!res.ok) {
    throw new ApiError(res.status, typeof json.message === "string" && json.message ? json.message : "Something went wrong.");
  }
  return { data: json.data, pagination: json.pagination ?? null };
}

function queryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

export interface ListResult<T> {
  rows: T[];
  total: number;
}

/* ---------- mappers (backend lean docs → existing frontend types) ---------- */

type Doc = Record<string, unknown> & { id: string };

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function optStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function timestamps(raw: Record<string, unknown>): { createdAt: string; updatedAt: string; deletedAt?: string } {
  const out: { createdAt: string; updatedAt: string; deletedAt?: string } = {
    createdAt: str(raw.createdAt, new Date(0).toISOString()),
    updatedAt: str(raw.updatedAt, new Date(0).toISOString()),
  };
  if (typeof raw.deletedAt === "string") out.deletedAt = raw.deletedAt;
  return out;
}

function publishStatus(value: unknown): "draft" | "published" | "hidden" {
  return value === "draft" || value === "hidden" ? value : "published";
}

function mapSemester(doc: Doc): Semester {
  return {
    id: doc.id,
    number: num(doc.number),
    name: str(doc.name),
    description: str(doc.description),
    subjectCount: num(doc.subjectCount),
    resourceCount: num(doc.resourceCount),
    credits: num(doc.credits),
    enrollment: "upcoming",
    order: num(doc.order, num(doc.number)),
    status: publishStatus(doc.status),
    ...timestamps(doc),
  };
}

function mapSubject(doc: Doc): Subject {
  const category = doc.category === "elective" || doc.category === "practical" ? doc.category : "core";
  return {
    id: doc.id,
    semesterId: str(doc.semesterId),
    name: str(doc.name),
    code: str(doc.code),
    description: str(doc.description),
    category,
    credits: num(doc.credits),
    offlineSync: 0,
    hotTopics: Array.isArray(doc.hotTopics) ? doc.hotTopics.filter((t): t is string => typeof t === "string") : [],
    fullMarks: typeof doc.fullMarks === "number" ? doc.fullMarks : undefined,
    status: publishStatus(doc.status),
    ...timestamps(doc),
  };
}

function mapTopic(doc: Doc): Topic {
  const status = publishStatus(doc.status);
  return {
    id: doc.id,
    subjectId: str(doc.subjectId),
    title: str(doc.title),
    description: optStr(doc.description),
    order: num(doc.order, 1),
    published: status === "published",
    status,
    ...timestamps(doc),
  };
}

const RESOURCE_TYPES = [
  "book",
  "short_note",
  "handwritten_note",
  "extra_note",
  "questions",
  "important_questions",
  "hot_topic",
  "topic",
  "past_paper",
  "revision_note",
  "practical",
  "custom",
] as const;

function mapResource(doc: Doc): Resource {
  const type = (RESOURCE_TYPES as readonly string[]).includes(doc.type as string)
    ? (doc.type as Resource["type"])
    : "custom";
  return {
    id: doc.id,
    title: str(doc.title),
    description: str(doc.description),
    semesterId: str(doc.semesterId),
    subjectId: str(doc.subjectId),
    topicId: optStr(doc.topicId),
    type,
    customType: optStr(doc.customType),
    fileName: str(doc.fileName),
    fileSize: num(doc.fileSize),
    pageCount: num(doc.pageCount, 1),
    tags: Array.isArray(doc.tags) ? doc.tags.filter((t): t is string => typeof t === "string") : [],
    uploadedAt: str(doc.uploadedAt, str(doc.createdAt, new Date(0).toISOString())),
    updatedAt: str(doc.updatedAt, new Date(0).toISOString()),
    bookId: optStr(doc.bookId),
    featured: doc.featured === true,
    paperYear: typeof doc.paperYear === "number" ? doc.paperYear : undefined,
    paperFullMarks: typeof doc.paperFullMarks === "number" ? doc.paperFullMarks : undefined,
    paperDurationMinutes: typeof doc.paperDurationMinutes === "number" ? doc.paperDurationMinutes : undefined,
    status: publishStatus(doc.status),
    hidden: doc.hidden === true,
    ...(typeof doc.deletedAt === "string" ? { deletedAt: doc.deletedAt } : {}),
  };
}

function mapBook(doc: Doc): Book {
  return {
    id: doc.id,
    title: str(doc.title),
    author: str(doc.author),
    description: str(doc.description),
    edition: str(doc.edition),
    semesterId: str(doc.semesterId),
    subjectId: str(doc.subjectId),
    resourceId: optStr(doc.resourceId),
    pageCount: num(doc.pageCount, 1),
    fileSize: num(doc.fileSize),
    status: publishStatus(doc.status),
    ...timestamps(doc),
  };
}

const NOTICE_TYPES = ["exam", "deadline", "assignment", "event", "important", "announcement", "reminder", "general"] as const;
const NOTICE_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const NOTICE_ANNOUNCERS = ["administration", "csit-department", "examination", "library"] as const;

function mapNotice(doc: Doc): Notice {
  const pick = <T extends string>(value: unknown, values: readonly T[], fallback: T): T =>
    typeof value === "string" && (values as readonly string[]).includes(value) ? (value as T) : fallback;
  return {
    id: doc.id,
    heading: str(doc.heading),
    subtext: str(doc.subtext),
    type: pick(doc.type, NOTICE_TYPES, "general"),
    announcer: pick(doc.announcer, NOTICE_ANNOUNCERS, "administration"),
    date: str(doc.date, new Date(0).toISOString()),
    priority: pick(doc.priority, NOTICE_PRIORITIES, "normal"),
    status: doc.status === "draft" ? "draft" : "published",
    publishedAt: optStr(doc.publishedAt),
    showOnDashboard: doc.showOnDashboard !== false,
    pinned: doc.pinned === true,
    ...timestamps(doc),
  };
}

/* ---------- academic fetchers ---------- */

export interface SemesterDetail extends Semester {
  subjects: Subject[];
}

export interface SubjectDetail extends Subject {
  topics: Topic[];
  resources: Resource[];
}

export interface TopicDetail extends Topic {
  resources: Resource[];
}

export interface BookDetail extends Book {
  resources: Resource[];
}

function nested<T>(value: unknown, map: (doc: Doc) => T): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is RawDoc => typeof entry === "object" && entry !== null)
    .map((entry) => map(withId(entry)));
}

export function fetchSemesters(signal?: AbortSignal): Promise<ListResult<Semester>> {
  return request<RawDoc[]>("/api/semesters?limit=100", { signal }).then(({ data, pagination }) => {
    const rows = (Array.isArray(data) ? data : []).map((doc) => mapSemester(withId(doc)));
    return { rows, total: pagination?.total ?? rows.length };
  });
}

export function fetchSemester(id: string, signal?: AbortSignal): Promise<SemesterDetail> {
  return request<RawDoc & { subjects?: RawDoc[] }>(`/api/semesters/${encodeURIComponent(id)}`, { signal }).then(({ data }) => ({
    ...mapSemester(withId(data)),
    subjects: nested(data.subjects, (doc) => mapSubject(withId(doc))),
  }));
}

export function fetchSubjects(semesterId: string, signal?: AbortSignal): Promise<ListResult<Subject>> {
  return request<RawDoc[]>(`/api/subjects${queryString({ semesterId, limit: 100 })}`, { signal }).then(({ data, pagination }) => {
    const rows = (Array.isArray(data) ? data : []).map((doc) => mapSubject(withId(doc)));
    return { rows, total: pagination?.total ?? rows.length };
  });
}

export function fetchSubject(id: string, signal?: AbortSignal): Promise<SubjectDetail> {
  return request<RawDoc & { topics?: RawDoc[]; resources?: RawDoc[] }>(`/api/subjects/${encodeURIComponent(id)}`, { signal }).then(({ data }) => ({
    ...mapSubject(withId(data)),
    topics: nested(data.topics, (doc) => mapTopic(withId(doc))),
    resources: nested(data.resources, (doc) => mapResource(withId(doc))),
  }));
}

export function fetchTopics(subjectId: string, signal?: AbortSignal): Promise<ListResult<Topic>> {
  return request<RawDoc[]>(`/api/topics${queryString({ subjectId, limit: 100 })}`, { signal }).then(({ data, pagination }) => {
    const rows = (Array.isArray(data) ? data : []).map((doc) => mapTopic(withId(doc)));
    return { rows, total: pagination?.total ?? rows.length };
  });
}

export function fetchTopic(id: string, signal?: AbortSignal): Promise<TopicDetail> {
  return request<RawDoc & { resources?: RawDoc[] }>(`/api/topics/${encodeURIComponent(id)}`, { signal }).then(({ data }) => ({
    ...mapTopic(withId(data)),
    resources: nested(data.resources, (doc) => mapResource(withId(doc))),
  }));
}

export interface ResourceFilters {
  semesterId?: string;
  subjectId?: string;
  topicId?: string;
  type?: string;
  tag?: string;
  limit?: number;
  page?: number;
}

export function fetchResources(filters: ResourceFilters = {}, signal?: AbortSignal): Promise<ListResult<Resource>> {
  return request<RawDoc[]>(`/api/resources${queryString({ limit: 50, ...filters })}`, { signal }).then(({ data, pagination }) => {
    const rows = (Array.isArray(data) ? data : []).map((doc) => mapResource(withId(doc)));
    return { rows, total: pagination?.total ?? rows.length };
  });
}

export function fetchResource(id: string, signal?: AbortSignal): Promise<Resource> {
  return request<RawDoc>(`/api/resources/${encodeURIComponent(id)}`, { signal }).then(({ data }) =>
    mapResource(withId(data)),
  );
}

export function fetchBooks(params: { semesterId?: string; subjectId?: string } = {}, signal?: AbortSignal): Promise<ListResult<Book>> {
  return request<RawDoc[]>(`/api/books${queryString({ limit: 100, ...params })}`, { signal }).then(({ data, pagination }) => {
    const rows = (Array.isArray(data) ? data : []).map((doc) => mapBook(withId(doc)));
    return { rows, total: pagination?.total ?? rows.length };
  });
}

export function fetchBook(id: string, signal?: AbortSignal): Promise<BookDetail> {
  return request<RawDoc & { resources?: RawDoc[] }>(`/api/books/${encodeURIComponent(id)}`, { signal }).then(({ data }) => ({
    ...mapBook(withId(data)),
    resources: nested(data.resources, (doc) => mapResource(withId(doc))),
  }));
}

export function fetchNotices(dashboardOnly: boolean, signal?: AbortSignal): Promise<ListResult<Notice>> {
  return request<RawDoc[]>(`/api/notices${queryString(dashboardOnly ? { dashboard: "true", limit: 50 } : { limit: 50 })}`, { signal }).then(
    ({ data, pagination }) => {
      const rows = (Array.isArray(data) ? data : []).map((doc) => mapNotice(withId(doc)));
      return { rows, total: pagination?.total ?? rows.length };
    },
  );
}

export function fetchNotice(id: string, signal?: AbortSignal): Promise<Notice> {
  return request<RawDoc>(`/api/notices/${encodeURIComponent(id)}`, { signal }).then(({ data }) =>
    mapNotice(withId(data)),
  );
}

/** Lightweight totals for card counts without fetching full lists. */
export async function fetchCount(path: string, params: Record<string, string | number | undefined>, signal?: AbortSignal): Promise<number> {
  const { pagination } = await request<unknown[]>(`${path}${queryString({ ...params, limit: 1 })}`, { signal });
  return pagination?.total ?? 0;
}
