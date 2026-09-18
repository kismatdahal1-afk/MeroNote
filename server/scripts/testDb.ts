/**
 * Shared test-database resolver for verify scripts.
 *
 * Default: ephemeral in-memory MongoDB — the real Atlas cluster is NEVER
 * touched, even when server/.env contains a real MONGODB_URI. (Relying on
 * env-blanking or holding .env aside is fragile: empty values do not survive
 * Windows process spawn, so dotenv silently reloads the real URI.)
 *
 * Escape hatch: ALLOW_REAL_DB=1 uses MONGODB_URI explicitly (for intentional
 * real-DB verification; the caller owns cleanup).
 */

export async function useTestDatabase(tag: string): Promise<{ uri: string; cleanup: () => Promise<void> }> {
  if (process.env.ALLOW_REAL_DB === "1") {
    const [{ env }] = await Promise.all([import("../src/config/env")]);
    if (!env.mongodbUri) throw new Error("ALLOW_REAL_DB=1 but MONGODB_URI is not set.");
    console.log("verify: ALLOW_REAL_DB=1 — using MONGODB_URI (writes will occur; clean up afterwards)");
    return { uri: env.mongodbUri, cleanup: async () => {} };
  }
  const [{ MongoMemoryServer }] = await Promise.all([import("mongodb-memory-server")]);
  const memory = await MongoMemoryServer.create();
  console.log("verify: using ephemeral in-memory MongoDB (real Atlas untouched)");
  return { uri: memory.getUri(`meronote-${tag}`), cleanup: () => memory.stop() };
}
