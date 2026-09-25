import type { Request, Response } from "express";
import { detailEnvelope, parseObjectId } from "../lib/api";
import { getPreferences, recordRecentResource } from "../repositories/preferences";

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
