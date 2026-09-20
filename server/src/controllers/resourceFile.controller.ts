import type { Request, Response } from "express";
import { Resource } from "../models";
import { liveResourceFilter } from "../repositories";
import { getDownloadUrl, StorageMissingError, StorageUnavailableError } from "../storage";
import { parseObjectId } from "../lib/api";

const URL_TTL_SECONDS = 900;

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

  const fileKey = resource.file.key;
  const t0 = Date.now();
  console.log(`[TIMING] FILE REQUEST START resourceId=${id} fileKey=${fileKey.substring(0, 40)}...`);

  try {
     const url = await getDownloadUrl(fileKey, URL_TTL_SECONDS);
    console.log(`[TIMING] FILE REQUEST DONE ${Date.now() - t0}ms resourceId=${id}`);
    res.json({ status: "ok", data: { url, expiresIn: URL_TTL_SECONDS } });
  } catch (err) {
    if (err instanceof StorageMissingError) {
      console.warn(`[TIMING] FILE NOT FOUND ${Date.now() - t0}ms resourceId=${id} fileKey=${fileKey.substring(0, 40)}...`);
      res.status(404).json({ status: "error", message: "PDF unavailable. The file is missing or was removed." });
      return;
    }
    if (err instanceof StorageUnavailableError) {
      console.warn(`[TIMING] UNAVAILABLE ${Date.now() - t0}ms resourceId=${id} fileKey=${fileKey.substring(0, 40)}...`, err.message);
      res.status(503).json({ status: "error", message: "Storage temporarily unavailable. Please try again later." });
      return;
    }
    console.error(`[TIMING] FILE REQUEST ERROR ${Date.now() - t0}ms resourceId=${id}`, err instanceof Error ? err.message : err);
    throw err;
  }
}
