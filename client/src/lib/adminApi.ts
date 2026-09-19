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

const json = (body: Record<string, unknown>): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export function adminList<T>(entity: AdminEntity, params: AdminListParams = {}, signal?: AbortSignal): Promise<{ rows: T[]; total: number; pages: number }> {
  return request<{ status: string; data: T[]; pagination: Pagination }>(`/api/admin/${entity}${queryString(params)}`, { signal }).then(
    (body) => ({ rows: body.data ?? [], total: body.pagination?.total ?? 0, pages: body.pagination?.pages ?? 1 }),
  );
}

export function adminGet<T>(entity: AdminEntity, id: string, signal?: AbortSignal): Promise<T> {
  return request<T>(`/api/admin/${entity}/${encodeURIComponent(id)}`, { signal });
}

export function adminCreate<T>(entity: AdminEntity, body: Record<string, unknown>): Promise<T> {
  return request<T>(`/api/admin/${entity}`, json(body));
}

export function adminUpdate<T>(entity: AdminEntity, id: string, body: Record<string, unknown>): Promise<T> {
  return request<T>(`/api/admin/${entity}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function adminDelete<T extends { id?: string; deleted?: boolean }>(entity: AdminEntity, id: string): Promise<T> {
  return request<T>(`/api/admin/${entity}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function adminRestore<T>(entity: AdminEntity, id: string): Promise<T> {
  return request<T>(`/api/admin/${entity}/${encodeURIComponent(id)}/restore`, { method: "POST" });
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
