import { Semester } from "../models";

/**
 * Fixed 8-semester bootstrap (Mero Note architecture rule).
 *
 * Mero Note uses exactly 8 fixed system-defined semesters (1 → 8).
 * There is no Add/Delete/Reorder/Duplicate semester feature — the admin API
 * rejects create/delete and order/number changes server-side.
 *
 * Canonical metadata below is taken from the historical FINAL NOW UI source
 * (client/src/data/mock.ts `semesters`, commit cf523de "FINALLLLL NOW") —
 * no invented labels.
 *
 * Idempotent: upserts on the stable natural key `number` (schema-unique,
 * 1–8). Re-running never creates duplicates, never deletes anything, never
 * touches subjects/topics/resources/books/notices, and preserves existing
 * `_id` identity so references stay valid.
 *
 * Uniqueness protection (already in semester.model.ts):
 * - number: unique, min 1, max 8  → a 9th semester cannot be stored.
 * - order:  unique               → stable 1 → 8 ordering.
 */

export interface FixedSemesterDef {
  number: number;
  name: string;
  description: string;
  credits: number;
}

export const FIXED_SEMESTERS: FixedSemesterDef[] = [
  { number: 1, name: "Semester 1", description: "Foundations of programming, mathematics, and computing.", credits: 15 },
  { number: 2, name: "Semester 2", description: "Digital logic, microprocessor fundamentals, and statistics.", credits: 15 },
  { number: 3, name: "Semester 3", description: "Data structures, numerical methods, and theory of computation.", credits: 15 },
  { number: 4, name: "Semester 4", description: "Algorithms, databases, operating systems fundamentals.", credits: 15 },
  { number: 5, name: "Semester 5", description: "Computer networks, simulation, and modelling.", credits: 18 },
  { number: 6, name: "Semester 6", description: "Software engineering, AI foundations, and graphics.", credits: 18 },
  { number: 7, name: "Semester 7", description: "Advanced electives: IoT, security, and distributed systems.", credits: 15 },
  { number: 8, name: "Semester 8", description: "Final semester: project work and advanced electives.", credits: 15 },
];

export interface EnsureFixedSemestersResult {
  matched: number;
  upserted: number;
  total: number;
}

/** Create exactly the 8 official semesters (upsert on `number`). */
export async function ensureFixedSemesters(): Promise<EnsureFixedSemestersResult> {
  const ops = FIXED_SEMESTERS.map((s) => ({
    updateOne: {
      filter: { number: s.number },
      update: {
        $set: {
          name: s.name,
          description: s.description,
          credits: s.credits,
          order: s.number,
          status: "published" as const,
        },
      },
      upsert: true,
    },
  }));
  const result = await Semester.bulkWrite(ops, { ordered: true });
  const matched = result.matchedCount ?? 0;
  const upserted = result.upsertedCount ?? 0;
  const total = await Semester.countDocuments({ number: { $gte: 1, $lte: 8 } }).exec();
  return { matched, upserted, total };
}
