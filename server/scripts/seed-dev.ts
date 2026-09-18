import dotenv from "dotenv";

dotenv.config();

/**
 * Dev-only seed CLI: `npm run seed:dev`
 *
 * Loads the UNMODIFIED frontend mock (via scripts/devSeedInput.ts),
 * transforms it per docs/backend-architecture.md §19 via src/seed/seedDev.ts,
 * and upserts it into the database from MONGODB_URI.
 *
 * Safety:
 * - Refuses to run when NODE_ENV=production.
 * - Idempotent (upserts + per-user personal-row replace) — safe to re-run.
 * - Never touches client/ files. Stores NO pdf binaries (pointer only).
 */

import { env } from "../src/config/env";
import { connectDb, disconnectDb } from "../src/db/connection";
import { seedDev } from "../src/seed/seedDev";
import { loadDevSeedInput } from "./devSeedInput";

async function main(): Promise<void> {
  if (env.nodeEnv === "production") {
    throw new Error("seed:dev refuses to run with NODE_ENV=production (dev database only).");
  }
  await connectDb();
  const result = await seedDev(loadDevSeedInput());
  console.log("seed:dev complete:", JSON.stringify(result));
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
