/**
 * Phase 16 semester-plan client — minimal typed wrapper for
 * GET|PATCH /api/me/semester-plan (cookie session, credentials:include).
 *
 * Reads are graceful (null on guest/failure, like studyApi lists) so the
 * provider can fall back to its local mirror. Writes throw
 * SemesterPlanApiError so the provider never pretends a failed save
 * succeeded. Also hosts the pure merge/migration helpers the provider and
 * tests share.
 */

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export type SemesterPlanStatus = "upcoming" | "ongoing" | "passed";

import { isObjectIdLike } from "./studyApi";

/** Shared ObjectId guard (re-exported so callers import from one place). */
export { isObjectIdLike };

export interface SemesterPlanRow {
  _id: string;
  userId: string;
  semesterId: string;
  status: SemesterPlanStatus;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SemesterPlanUpdate {
  status?: SemesterPlanStatus;
  startDate?: string;
  endDate?: string;
}

export class SemesterPlanApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SemesterPlanApiError";
    this.status = status;
  }
}

export function isPlanStatus(value: unknown): value is SemesterPlanStatus {
  return value === "upcoming" || value === "ongoing" || value === "passed";
}

/** Strict yyyy-mm-dd calendar date (matches the server contract). */
export function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** A usable term pair: two valid calendar dates with end strictly after start. */
export function isValidDatePair(startDate: unknown, endDate: unknown): boolean {
  return (
    isValidCalendarDate(startDate) && isValidCalendarDate(endDate) && (endDate as string) > (startDate as string)
  );
}

export type PlanState = {
  statuses: Record<string, SemesterPlanStatus>;
  dates: Record<string, { startDate: string; endDate: string }>;
};

/** Server rows win: duplicates are impossible via the unique index, so the
 *  first valid row per semesterId determines state; invalid rows dropped. */
export function mergePlanRowsToState(rows: SemesterPlanRow[]): PlanState {
  const statuses: Record<string, SemesterPlanStatus> = {};
  const dates: Record<string, { startDate: string; endDate: string }> = {};
  for (const row of rows) {
    if (!row || !isObjectIdLike(row.semesterId) || !isPlanStatus(row.status)) continue;
    statuses[row.semesterId] = row.status;
    if (isValidCalendarDate(row.startDate) && isValidCalendarDate(row.endDate) && row.endDate > row.startDate) {
      dates[row.semesterId] = { startDate: row.startDate, endDate: row.endDate };
    }
  }
  return { statuses, dates };
}

export interface MigrationEntry extends SemesterPlanUpdate {
  semesterId: string;
  status: SemesterPlanStatus;
}

/**
 * Eligible one-time migration payload from legacy device state.
 * Only well-formed entries (real ObjectId, known status, valid date pair)
 * are migrated; junk is left behind, never sent.
 */
export function selectMigrationPayload(
  statuses: Record<string, string>,
  dates: Record<string, { startDate?: unknown; endDate?: unknown }>,
): MigrationEntry[] {
  const out: MigrationEntry[] = [];
  for (const [semesterId, status] of Object.entries(statuses)) {
    if (!isObjectIdLike(semesterId) || !isPlanStatus(status)) continue;
    const pair = dates[semesterId];
    const startDate = pair?.startDate;
    const endDate = pair?.endDate;
    if (isValidCalendarDate(startDate) && isValidCalendarDate(endDate) && endDate > startDate) {
      out.push({ semesterId, status, startDate, endDate });
    } else {
      out.push({ semesterId, status });
    }
  }
  return out;
}

/** User-scoped local mirror key — never shared across users. */
export function mirrorKeyFor(userId: string | null): string {
  return userId ? `meronote-semester-enrollment.v2.${userId}` : "meronote-semester-enrollment";
}

export async function getSemesterPlan(signal?: AbortSignal): Promise<SemesterPlanRow[] | null> {
  try {
    const res = await fetch(`${API_URL}/api/me/semester-plan`, { credentials: "include", signal });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as { data?: SemesterPlanRow[] } | null;
    return Array.isArray(json?.data) ? json.data : null;
  } catch {
    return null;
  }
}

export async function updateSemesterPlan(
  semesterId: string,
  payload: SemesterPlanUpdate,
): Promise<SemesterPlanRow> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/me/semester-plan/${semesterId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new SemesterPlanApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => null)) as { data?: SemesterPlanRow; message?: string } | null;
  if (!res.ok || !json?.data) {
    throw new SemesterPlanApiError(
      res.status,
      typeof json?.message === "string" && json.message ? json.message : "Could not save the semester plan.",
    );
  }
  return json.data;
}
