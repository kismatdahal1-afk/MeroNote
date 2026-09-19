import dotenv from "dotenv";

dotenv.config();

/**
 * Fixed 8-semester bootstrap CLI: `npm run ensure:fixed-semesters`
 *
 * Inserts ONLY the 8 official Semester records (Semester 1–8, canonical
 * metadata from the FINAL NOW UI source). Idempotent: upserts on the
 * stable natural key `number`, so re-running never creates duplicates,
 * never deletes anything, and never touches subjects/topics/resources/
 * books/notices. Existing `_id` identity is preserved.
 *
 * Intended for the real Atlas bootstrap (currently 0 semesters). Uses
 * MONGODB_URI from server/.env. Prints exactly what will be / was written.
 */

import { env } from "../src/config/env";
import { connectDb, disconnectDb } from "../src/db/connection";
import { Semester } from "../src/models";
import { FIXED_SEMESTERS, ensureFixedSemesters } from "../src/seed/fixedSemesters";

async function main(): Promise<void> {
  if (!env.mongodbUri) throw new Error("MONGODB_URI is not set (see server/.env.example).");
  console.log("Fixed 8-semester bootstrap — will upsert exactly these records (by number):");
  for (const s of FIXED_SEMESTERS) {
    console.log(`  ${s.number}: ${s.name} — ${s.description} (${s.credits} credits)`);
  }
  const before = await Semester.countDocuments().exec().catch(() => -1);
  await connectDb();
  try {
    const result = await ensureFixedSemesters();
    console.log(
      `ensure:fixed-semesters complete: matched=${result.matched} upserted=${result.upserted} total(1–8)=${result.total} (semesters collection before=${before})`,
    );
    if (result.total !== 8) {
      console.error(`UNEXPECTED: expected exactly 8 official semesters, found total=${result.total}.`);
      process.exitCode = 1;
    }
  } finally {
    await disconnectDb();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
