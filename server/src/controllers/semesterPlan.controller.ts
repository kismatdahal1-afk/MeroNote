import type { Request, Response } from "express";
import { SEMESTER_USER_STATUSES, UserSemesterPlan } from "../models";
import { detailEnvelope, parseObjectId } from "../lib/api";
import {
  getUserSemesterPlans,
  semesterIsAvailable,
  upsertUserSemesterPlan,
  type SemesterUserStatus,
} from "../repositories/semesterPlans";

const STATUS_VALUES: readonly string[] = SEMESTER_USER_STATUSES;

function isStatus(value: unknown): value is SemesterUserStatus {
  return typeof value === "string" && STATUS_VALUES.includes(value);
}

/**
 * Strict calendar-date parsing for UI date inputs (yyyy-mm-dd).
 * Constructed as UTC midnight so Nepal (+0545) and other timezones never
 * shift 2026-09-01 into 2026-08-31. Returns null when invalid.
 */
function parseCalendarDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Reject impossible dates (e.g. 2026-02-30 → rolls into March).
  if (d.toISOString().slice(0, 10) !== value) return null;
  return d;
}

export async function listSemesterPlan(req: Request, res: Response): Promise<void> {
  const rows = await getUserSemesterPlans(req.user!.id);
  res.json(detailEnvelope(rows));
}

/**
 * PATCH /api/me/semester-plan/:semesterId — partial update of one plan row.
 * Body may contain any subset of { status, startDate, endDate }.
 */
export async function patchSemesterPlan(req: Request, res: Response): Promise<void> {
  const semesterId = parseObjectId(req.params.semesterId);
  if (!semesterId) {
    res.status(400).json({ status: "error", message: "Invalid semester id." });
    return;
  }
  if (!(await semesterIsAvailable(semesterId))) {
    res.status(404).json({ status: "error", message: "Semester not found." });
    return;
  }

  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as Record<string, unknown>;
  const hasStatus = body.status !== undefined;
  const hasStart = body.startDate !== undefined;
  const hasEnd = body.endDate !== undefined;
  if (!hasStatus && !hasStart && !hasEnd) {
    res
      .status(400)
      .json({ status: "error", message: "Body must contain at least one of: 'status', 'startDate', 'endDate'." });
    return;
  }

  let status: SemesterUserStatus | undefined;
  if (hasStatus) {
    if (!isStatus(body.status)) {
      res.status(400).json({ status: "error", message: `Field 'status' must be one of: ${STATUS_VALUES.join(", ")}.` });
      return;
    }
    status = body.status;
  }

  let startDate: Date | undefined;
  let endDate: Date | undefined;
  if (hasStart) {
    const parsed = parseCalendarDate(body.startDate);
    if (!parsed) {
      res.status(400).json({ status: "error", message: "Field 'startDate' must be a calendar date (yyyy-mm-dd)." });
      return;
    }
    startDate = parsed;
  }
  if (hasEnd) {
    const parsed = parseCalendarDate(body.endDate);
    if (!parsed) {
      res.status(400).json({ status: "error", message: "Field 'endDate' must be a calendar date (yyyy-mm-dd)." });
      return;
    }
    endDate = parsed;
  }

  // Validate the resulting (stored + incoming) combination so partial updates
  // cannot leave endDate <= startDate, including for ongoing plans.
  const existing = await UserSemesterPlan.findOne({ userId: req.user!.id, semesterId }).lean().exec();
  const resultStart = startDate ?? existing?.startDate ?? undefined;
  const resultEnd = endDate ?? existing?.endDate ?? undefined;
  if (resultStart && resultEnd && resultEnd <= resultStart) {
    res.status(400).json({ status: "error", message: "Field 'endDate' must be after 'startDate'." });
    return;
  }

  try {
    const row = await upsertUserSemesterPlan(req.user!.id, semesterId, { status, startDate, endDate });
    res.json(detailEnvelope(row));
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ status: "error", message: "Conflicting semester plan update. Please retry." });
      return;
    }
    throw err;
  }
}
