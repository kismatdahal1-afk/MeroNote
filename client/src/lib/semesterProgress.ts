import { clamp } from "./utils";

export interface SemesterProgress {
  /** Total days from start to end date (inclusive of start, exclusive of end). */
  totalDays: number;
  /** Whole days elapsed since the start date; never negative. */
  elapsedDays: number;
  /** Whole days left in the semester; never negative. */
  remainingDays: number;
  /** Elapsed share of the term, clamped 0..100. */
  percentage: number;
  /** True when the term has fully elapsed. */
  isComplete: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Semester progress from a user-defined start/end date range.
 * Nothing is hardcoded — the duration comes entirely from the dates:
 *
 *   totalDays    = end - start (in days)
 *   elapsedDays  = now - start (floored to day boundaries, >= 0)
 *   remainingDays= totalDays - elapsedDays (clamped >= 0)
 *   percentage   = (elapsedDays / totalDays) × 100, clamped 0..100
 */
export function calculateSemesterProgress(
  startDate: string,
  endDate: string,
  now: Date = new Date(),
): SemesterProgress {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const totalDays = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
  if (!Number.isFinite(totalDays) || totalDays <= 0) {
    return { totalDays: 0, elapsedDays: 0, remainingDays: 0, percentage: 0, isComplete: false };
  }

  const elapsedDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / MS_PER_DAY));
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const percentage = clamp((elapsedDays / totalDays) * 100, 0, 100);

  return { totalDays, elapsedDays, remainingDays, percentage, isComplete: elapsedDays >= totalDays };
}
