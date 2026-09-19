/**
 * Typed client for the Phase 11 Admin CMS API (/api/admin/*).
 * All calls require an ADMIN session (HttpOnly cookie); 401/403 surface as
 * ApiError for the UI to handle. Multipart upload uses FormData directly.
 */

import { ApiError, Pagination } from "./contentApi";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export type AdminEntity = "semesters" | "subjects" | "topics" | "resources" | "books" | "notices";

export interface AdminListParams {
  status?: string;
  hidden?: string;
  includeDeleted?: boolean;
  semesterId?: string;
  subjectId?: string;
  topicId?: string;
  type?: string;
  tag?: string;
  priority?: string;
  page?: number;
  limit?: number;
}

export interface AdminFileMeta {
  fileName?: string;
  fileSize?: number;
  mime?: string;
  checksum?: string;
  pageCount?: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      ...(init?.body instanceof FormData ? {} : { headers: { "content-type": "application/json" } }),
      ...init,
      signal: init?.signal ?? null,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as { data?: T; pagination?: Pagination; message?: string };
  if (!res.ok) {
    throw new ApiError(res.status, typeof json.message === "string" && json.message ? json.message : "Something went wrong.");
  }
  return json.data as T;
}

function queryString(params: AdminListParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    query.set(key, typeof value === "boolean" ? "true" : String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

/** Envelope-preserving fetch for list endpoints (keeps `data` + `pagination`). */
async function listEnvelope<T>(path: string, init?: RequestInit): Promise<{ data: T; pagination: Pagination | null }> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      ...(init?.body instanceof FormData ? {} : { headers: { "content-type": "application/json" } }),
      ...init,
      signal: init?.signal ?? null,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as { data?: T; pagination?: Pagination; message?: string };
  if (!res.ok) {
    throw new ApiError(res.status, typeof json.message === "string" && json.message ? json.message : "Something went wrong.");
  }
  return { data: json.data as T, pagination: json.pagination ?? null };
}

const json = (body: Record<string, unknown>): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

type RawDoc = Record<string, unknown> & { _id?: unknown; id?: string };

/**
 * Backend lean docs serialize with `_id` (no `id` virtual). Normalize to the
 * frontend's string `id` shape — mirrors contentApi.withId so admin rows join
 * correctly (semester sections, subject filters, React keys, create flows).
 */
function refId(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record._id === "string" || typeof record._id === "number") return String(record._id);
    if (typeof record.id === "string") return record.id;
  }
  return undefined;
}

function withAdminId<T>(row: T): T {
  if (typeof row !== "object" || row === null) return row;
  const raw = row as RawDoc;
  const out: Record<string, unknown> = { ...raw };
  if (raw._id !== undefined) {
    out.id = typeof raw._id === "string" || typeof raw._id === "number" ? String(raw._id) : String(raw.id ?? "");
    delete out._id;
  }
  for (const key of ["semesterId", "subjectId", "topicId", "bookId", "resourceId", "userId"]) {
    if (out[key] !== undefined) {
      const normalized = refId(out[key]);
      if (normalized !== undefined) out[key] = normalized;
    }
  }
  return out as T;
}

export function adminList<T>(entity: AdminEntity, params: AdminListParams = {}, signal?: AbortSignal): Promise<{ rows: T[]; total: number; pages: number }> {
  // NOTE: request() already unwraps the `{status,data}` envelope, so a list
  // must read the envelope itself — going through request() here would unwrap
  // twice and always yield rows: [] (the Admin Semesters zero-state bug).
  return listEnvelope<T[]>(`/api/admin/${entity}${queryString(params)}`, { signal }).then(
    ({ data, pagination }) => ({
      rows: (data ?? []).map(withAdminId),
      total: pagination?.total ?? 0,
      pages: pagination?.pages ?? 1,
    }),
  );
}

export function adminGet<T>(entity: AdminEntity, id: string, signal?: AbortSignal): Promise<T> {
  return request<T>(`/api/admin/${entity}/${encodeURIComponent(id)}`, { signal }).then(withAdminId);
}

export function adminCreate<T>(entity: AdminEntity, body: Record<string, unknown>): Promise<T> {
  // Normalized like list/get: create responses are raw detail docs (`_id`,
  // no `id`), and callers chain on `.id` (e.g. create-then-upload in
  // ResourceEditorModal) — an unmapped return yields `undefined` and the
  // upload hits `/undefined/file` → 400 "Invalid resource id."
  return request<T>(`/api/admin/${entity}`, json(body)).then(withAdminId);
}

export function adminUpdate<T>(entity: AdminEntity, id: string, body: Record<string, unknown>): Promise<T> {
  return request<T>(`/api/admin/${entity}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }).then(withAdminId);
}

export function adminDelete<T extends { id?: string; deleted?: boolean }>(entity: AdminEntity, id: string): Promise<T> {
  return request<T>(`/api/admin/${entity}/${encodeURIComponent(id)}`, { method: "DELETE" }).then(withAdminId);
}

export function adminRestore<T>(entity: AdminEntity, id: string): Promise<T> {
  return request<T>(`/api/admin/${entity}/${encodeURIComponent(id)}/restore`, { method: "POST" }).then(withAdminId);
}

export function adminUploadFile(resourceId: string, file: File, pageCount?: number): Promise<AdminFileMeta> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (pageCount !== undefined) form.append("pageCount", String(pageCount));
  return request<AdminFileMeta>(`/api/admin/resources/${encodeURIComponent(resourceId)}/file`, {
    method: "POST",
    body: form,
  });
}

export function adminDeleteFile(resourceId: string): Promise<{ id: string; removed: boolean }> {
  return request(`/api/admin/resources/${encodeURIComponent(resourceId)}/file`, { method: "DELETE" });
}
