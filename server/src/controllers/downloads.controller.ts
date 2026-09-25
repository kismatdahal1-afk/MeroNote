import type { Request, Response } from "express";
import { detailEnvelope, listEnvelope, parseObjectId, parsePagination } from "../lib/api";
import {
  downloadTargetIsLive,
  listUserDownloads,
  registerDownload,
  removeDownload,
  verifyDownload,
} from "../repositories/downloads";

/** GET /api/me/downloads — the caller's account-level download history. */
export async function listDownloads(req: Request, res: Response): Promise<void> {
  const pagination = parsePagination(req.query);
  if ("error" in pagination) {
    res.status(400).json({ status: "error", message: pagination.error });
    return;
  }
  const { page, limit } = pagination;
  const { total, rows } = await listUserDownloads(req.user!.id, page, limit);
  res.json(listEnvelope(rows, page, limit, total));
}

/**
 * PUT /api/me/downloads/:resourceId — idempotent completion registration.
 * 201 on first registration, 200 on re-download. Only the explicit Download
 * action calls this, after the local IndexedDB write succeeded (opening a
 * PDF never creates history). Never stores PDF bytes.
 */
export async function putDownload(req: Request, res: Response): Promise<void> {
  const resourceId = parseObjectId(req.params.resourceId);
  if (!resourceId) {
    res.status(400).json({ status: "error", message: "Invalid resource id." });
    return;
  }
  if (!(await downloadTargetIsLive(resourceId))) {
    res.status(404).json({ status: "error", message: "Resource not found." });
    return;
  }

  // Optional actual byte count (blob.size from the completed local write).
  // Anything else is ignored — the server never trusts estimates as fact.
  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as Record<string, unknown>;
  let fileSize: number | undefined;
  if (body.fileSize !== undefined) {
    if (typeof body.fileSize !== "number" || !Number.isInteger(body.fileSize) || body.fileSize < 1) {
      res.status(400).json({ status: "error", message: "Field 'fileSize' must be a positive integer." });
      return;
    }
    fileSize = body.fileSize;
  }

  try {
    const { row, created } = await registerDownload(req.user!.id, resourceId, { fileSize });
    res.status(created ? 201 : 200).json(detailEnvelope(row));
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ status: "error", message: "Conflicting download registration. Please retry." });
      return;
    }
    throw err;
  }
}

/**
 * PATCH /api/me/downloads/:resourceId — verification/metadata refresh only.
 * Body may contain { verify: true } (confirm the local file still exists)
 * and/or { fileSize } (correct the byte count). Never touches downloadedAt,
 * so verification never reorders history. 404 when no history row exists.
 */
export async function patchDownload(req: Request, res: Response): Promise<void> {
  const resourceId = parseObjectId(req.params.resourceId);
  if (!resourceId) {
    res.status(400).json({ status: "error", message: "Invalid resource id." });
    return;
  }
  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as Record<string, unknown>;
  const verify = body.verify === undefined ? undefined : body.verify === true;
  if (verify === undefined && body.fileSize === undefined) {
    res.status(400).json({ status: "error", message: "Body must contain at least one of: 'verify', 'fileSize'." });
    return;
  }
  if (body.verify !== undefined && body.verify !== true) {
    res.status(400).json({ status: "error", message: "Field 'verify' must be true when present." });
    return;
  }
  let fileSize: number | undefined;
  if (body.fileSize !== undefined) {
    if (typeof body.fileSize !== "number" || !Number.isInteger(body.fileSize) || body.fileSize < 1) {
      res.status(400).json({ status: "error", message: "Field 'fileSize' must be a positive integer." });
      return;
    }
    fileSize = body.fileSize;
  }
  const row = await verifyDownload(req.user!.id, resourceId, { verify: verify === true, fileSize });
  if (!row) {
    res.status(404).json({ status: "error", message: "Download history not found." });
    return;
  }
  res.json(detailEnvelope(row));
}

/**
 * DELETE /api/me/downloads/:resourceId — remove from account Downloads.
 * Hard-deletes the history row (idempotent { removed }). Never touches the
 * physical IndexedDB blob: deleting history while the file exists yields a
 * local-only orphan (Phase 19 reconciliation); re-download reactivates via
 * the standard idempotent PUT with no duplicate row.
 */
export async function deleteDownload(req: Request, res: Response): Promise<void> {
  const resourceId = parseObjectId(req.params.resourceId);
  if (!resourceId) {
    res.status(400).json({ status: "error", message: "Invalid resource id." });
    return;
  }
  const removed = await removeDownload(req.user!.id, resourceId);
  res.json(detailEnvelope({ removed }));
}
