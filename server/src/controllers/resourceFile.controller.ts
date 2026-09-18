import type { Request, Response } from "express";
import { Resource } from "../models";
import { liveResourceFilter } from "../repositories";
import { getDownloadUrl, objectExists, StorageMissingError, StorageNotConfiguredError } from "../storage";
import { parseObjectId } from "../lib/api";

const URL_TTL_SECONDS = 900;

/**
 * Phase 6 secure PDF access: GET /api/resources/:id/file
 *
 * Public read (Phase 4 decision) over live resources only — drafts, hidden
 * and soft-deleted resources are unreachable here (404), exactly as in the
 * resource detail endpoint. Returns a short-lived presigned URL minted by
 * the Phase 5 storage service; B2 credentials never leave the server and
 * presigned URLs are never logged.
 */
export async function getResourceFile(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  if (!id) {
    res.status(400).json({ status: "error", message: "Invalid resource id." });
    return;
  }

  const resource = await Resource.findOne({ _id: id, ...liveResourceFilter() }).lean().exec();
  if (!resource) {
    res.status(404).json({ status: "error", message: "Resource not found." });
    return;
  }
  if (!resource.file?.key) {
    res.status(410).json({ status: "error", message: "This resource has no file attached yet." });
    return;
  }

  try {
    if (!(await objectExists(resource.file.key))) {
      res.status(503).json({ status: "error", message: "The file is temporarily unavailable. Please try again later." });
      return;
    }
    const url = await getDownloadUrl(resource.file.key, URL_TTL_SECONDS);
    res.json({ status: "ok", data: { url, expiresIn: URL_TTL_SECONDS } });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError || err instanceof StorageMissingError) {
      res.status(503).json({ status: "error", message: "The file is temporarily unavailable. Please try again later." });
      return;
    }
    throw err;
  }
}
