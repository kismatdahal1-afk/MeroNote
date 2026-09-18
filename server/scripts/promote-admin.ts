import dotenv from "dotenv";

dotenv.config();

/**
 * Dev-only admin promotion: `npm run promote-admin -- user@example.com`
 *
 * Register always creates USER; this is the only path to ADMIN.
 * Refuses to run with NODE_ENV=production. Prints no credentials.
 */

import { env } from "../src/config/env";
import { connectDb, disconnectDb } from "../src/db/connection";
import { promoteToAdmin } from "../src/auth/promote";

async function main(): Promise<void> {
  if (env.nodeEnv === "production") {
    throw new Error("promote-admin refuses to run with NODE_ENV=production.");
  }
  const result = await run();
  console.log(`promote-admin complete: ${result.email} is now ADMIN.`);
}

export async function run(): Promise<{ email: string; role: string }> {
  await connectDb();
  return promoteToAdmin(process.argv[2] ?? "");
}

const invokedDirectly = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/promote-admin.ts") ?? false;
if (invokedDirectly) {
  main()
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => disconnectDb());
}
