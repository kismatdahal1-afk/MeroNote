/**
 * Minimal client for the Phase 6 secure file endpoint.
 * Only the short-lived presigned URL is ever handled here — the binary is
 * streamed by PDF.js, never stored in application state.
 */

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export interface ResourceFileAccess {
  url: string;
  expiresIn: number;
}

export class FileApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "FileApiError";
    this.status = status;
  }
}

export async function fetchResourceFileUrl(resourceId: string): Promise<ResourceFileAccess> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/resources/${encodeURIComponent(resourceId)}/file`, {
      credentials: "include",
    });
  } catch {
    throw new FileApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as {
    data?: ResourceFileAccess;
    message?: string;
  };
  if (!res.ok) {
    if (res.status === 404) throw new FileApiError(404, "This resource is not available.");
    if (res.status === 410) throw new FileApiError(410, "This resource has no file attached yet.");
    if (res.status === 503) {
      throw new FileApiError(503, "The file service is temporarily unavailable. Please try again later.");
    }
    throw new FileApiError(
      res.status,
      typeof json.message === "string" && json.message ? json.message : "Couldn't open this file.",
    );
  }
  if (!json.data || typeof json.data.url !== "string") {
    throw new FileApiError(res.status, "Couldn't open this file.");
  }
  return json.data;
}
