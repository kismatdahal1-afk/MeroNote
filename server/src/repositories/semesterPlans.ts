import { Semester, UserSemesterPlan } from "../models";
import { liveFilter } from "./content";

/**
 * Phase 16 user-semester-plan data access.
 *
 * Ownership always derives from the caller's userId (never from client
 * input). Setting a semester to ongoing demotes any other ongoing plan of
 * the same user first; the partial unique index `user_ongoing_unique` is
 * the final database guard against concurrent double-ongoing.
 */

export type SemesterUserStatus = "upcoming" | "ongoing" | "passed";

export interface SemesterPlanInput {
  status?: SemesterUserStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface SemesterPlanRow {
  _id: string;
  userId: string;
  semesterId: string;
  status: SemesterUserStatus;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface LeanPlanRow {
  _id: unknown;
  userId: unknown;
  semesterId: unknown;
  status: SemesterUserStatus;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

function serializeLean(doc: LeanPlanRow): SemesterPlanRow {
  const row: SemesterPlanRow = {
    _id: String(doc._id),
    userId: String(doc.userId),
    semesterId: String(doc.semesterId),
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
  if (doc.startDate) row.startDate = toDateInputValue(doc.startDate);
  if (doc.endDate) row.endDate = toDateInputValue(doc.endDate);
  return row;
}

/** Referenced semester must exist and be visible to students. */
export async function semesterIsAvailable(semesterId: string): Promise<boolean> {
  return (await Semester.exists({ _id: semesterId, ...liveFilter() })) !== null;
}

export async function getUserSemesterPlans(userId: string): Promise<SemesterPlanRow[]> {
  const rows = await UserSemesterPlan.find({ userId }).sort({ updatedAt: -1 }).lean().exec();
  return rows.map((r) =>
    serializeLean({
      _id: r._id,
      userId: r.userId,
      semesterId: r.semesterId,
      status: r.status,
      startDate: r.startDate ?? undefined,
      endDate: r.endDate ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }),
  );
}

export async function getUserOngoingSemester(userId: string): Promise<SemesterPlanRow | null> {
  const row = await UserSemesterPlan.findOne({ userId, status: "ongoing" }).lean().exec();
  if (!row) return null;
  return serializeLean({
    _id: row._id,
    userId: row.userId,
    semesterId: row.semesterId,
    status: row.status,
    startDate: row.startDate ?? undefined,
    endDate: row.endDate ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Create-or-update one user's plan for one semester.
 * - No duplicate rows: unique { userId, semesterId } (+11000 retry below).
 * - Ongoing switch: demote the user's other ongoing plans before promoting.
 *   Demote-then-promote is not atomic, so two concurrent promotions can
 *   collide on the partial `user_ongoing_unique` index; the loser retries
 *   once (demote is idempotent, so the retry converges) and only a repeated
 *   collision surfaces as 409. The index — never the app layer alone — is
 *   the final guard: two ongoing rows for one user can never persist.
 * - Never touches other users' rows.
 */
export async function upsertUserSemesterPlan(
  userId: string,
  semesterId: string,
  input: SemesterPlanInput,
): Promise<SemesterPlanRow> {
  const set: Record<string, unknown> = {};
  const setOnInsert: Record<string, unknown> = { userId, semesterId };
  if (input.status !== undefined) {
    set.status = input.status;
  } else {
    // Dates-only write on a new row starts as upcoming; never placed in
    // both $set and $setOnInsert (MongoDB path conflict).
    setOnInsert.status = "upcoming";
  }
  if (input.startDate !== undefined) set.startDate = input.startDate;
  if (input.endDate !== undefined) set.endDate = input.endDate;

  const promoteToOngoing = input.status === "ongoing";

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      if (promoteToOngoing) {
        await UserSemesterPlan.updateMany(
          { userId, status: "ongoing", semesterId: { $ne: semesterId } },
          { $set: { status: "upcoming" } },
        ).exec();
      }
      const row = await UserSemesterPlan.findOneAndUpdate(
        { userId, semesterId },
        { $set: set, $setOnInsert: setOnInsert },
        { upsert: true, returnDocument: "after", runValidators: true },
      ).exec();
      if (!row) throw new Error("Semester plan upsert unexpectedly returned no document.");
      return serializeLean(row);
    } catch (err) {
      lastError = err;
      // Lost a race on the one-ongoing index: retry once after the rival's
      // row is visible (the re-demote above then converges). Anything else,
      // or a second collision, propagates to the caller (→ 409 for 11000).
      if ((err as { code?: number }).code !== 11000 || attempt === 1) throw err;
    }
  }
  throw lastError;
}

export async function setSemesterStatus(
  userId: string,
  semesterId: string,
  status: SemesterUserStatus,
): Promise<SemesterPlanRow> {
  return upsertUserSemesterPlan(userId, semesterId, { status });
}

export async function setSemesterDates(
  userId: string,
  semesterId: string,
  startDate: Date,
  endDate: Date,
): Promise<SemesterPlanRow> {
  return upsertUserSemesterPlan(userId, semesterId, { startDate, endDate });
}
