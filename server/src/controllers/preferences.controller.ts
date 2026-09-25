import type { Request, Response } from "express";
import { detailEnvelope, parseObjectId } from "../lib/api";
import {
  addContinueReading,
  continueReadingTargetIsLive,
  getPreferences,
  recordRecentResource,
  removeContinueReading,
} from "../repositories/preferences";

/**
 * GET /api/me/preferences — the caller's preferences (recent resources).
 * Never 404s: an absent document reads as empty defaults without creating
 * one (the first intentional open creates it via POST /recent).
 */
export async function getPreferencesRoute(req: Request, res: Response): Promise<void> {
  res.json(detailEnvelope(await getPreferences(req.user!.id)));
}

/**
 * POST /api/me/preferences/recent — record one intentional resource open.
 * Body { resourceId }. Atomic dedupe + prepend + cap server-side; always
 * 200 with the updated recents. Client contract keeps this non-blocking:
 * navigation never waits on it.
 */
export async function postRecent(req: Request, res: Response): Promise<void> {
  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as Record<string, unknown>;
  const resourceId = parseObjectId(body.resourceId);
  if (!resourceId) {
    res.status(400).json({ status: "error", message: "Field 'resourceId' must be a valid id." });
    return;
  }
  res.json(detailEnvelope({ recentResources: await recordRecentResource(req.user!.id, resourceId) }));
}

/**
 * PUT /api/me/preferences/continue-reading/:resourceId — explicitly add one
 * resource to the caller's Continue Reading list. Idempotent: 201 on first
 * add, 200 when already present. Only explicit user action calls this;
 * opens, progress, and recents never create membership. 404 when the
 * resource is not currently available.
 */
export async function putContinueReading(req: Request, res: Response): Promise<void> {
  const resourceId = parseObjectId(req.params.resourceId);
  if (!resourceId) {
    res.status(400).json({ status: "error", message: "Invalid resource id." });
    return;
  }
  if (!(await continueReadingTargetIsLive(resourceId))) {
    res.status(404).json({ status: "error", message: "Resource not found." });
    return;
  }
  try {
    const { added } = await addContinueReading(req.user!.id, resourceId);
    res.status(added ? 201 : 200).json(detailEnvelope({ resourceId, added }));
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ status: "error", message: "Conflicting update. Please retry." });
      return;
    }
    throw err;
  }
}

/**
 * DELETE /api/me/preferences/continue-reading/:resourceId — explicitly
 * remove one resource from Continue Reading. Idempotent ({ removed }).
 * Never touches Reading Progress, Recent Resources, or the resource itself.
 */
export async function deleteContinueReading(req: Request, res: Response): Promise<void> {
  const resourceId = parseObjectId(req.params.resourceId);
  if (!resourceId) {
    res.status(400).json({ status: "error", message: "Invalid resource id." });
    return;
  }
  const removed = await removeContinueReading(req.user!.id, resourceId);
  res.json(detailEnvelope({ removed }));
}
