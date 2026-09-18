/**
 * Minimal client for the Phase 10 unified search API.
 * Read-only; AbortController-friendly for debounced typing.
 */

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export type SearchEntityType = "semester" | "subject" | "topic" | "resource" | "book" | "notice";

export interface SearchResultRow {
  entityType: SearchEntityType;
  id: string;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface SearchPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface SearchResponse {
  data: SearchResultRow[];
  pagination: SearchPagination;
}

export class SearchError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SearchError";
    this.status = status;
  }
}

export interface SearchParams {
  q: string;
  entityType?: SearchEntityType;
  type?: string;
  tag?: string;
  semesterId?: string;
  subjectId?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

export async function searchContent(params: SearchParams): Promise<SearchResponse> {
  const query = new URLSearchParams();
  query.set("q", params.q);
  if (params.entityType) query.set("entityType", params.entityType);
  if (params.type) query.set("type", params.type);
  if (params.tag) query.set("tag", params.tag);
  if (params.semesterId) query.set("semesterId", params.semesterId);
  if (params.subjectId) query.set("subjectId", params.subjectId);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.limit !== undefined) query.set("limit", String(params.limit));

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/search?${query.toString()}`, {
      credentials: "include",
      signal: params.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new SearchError(0, "Search is unavailable offline.");
  }
  const json = (await res.json().catch(() => ({}))) as {
    data?: SearchResultRow[];
    pagination?: SearchPagination;
    message?: string;
  };
  if (!res.ok) {
    throw new SearchError(
      res.status,
      typeof json.message === "string" && json.message ? json.message : "Search failed. Please try again.",
    );
  }
  return { data: json.data ?? [], pagination: json.pagination ?? { page: 1, limit: 20, total: 0, pages: 1 } };
}
