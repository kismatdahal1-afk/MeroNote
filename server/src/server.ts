import { createApp } from "./app";
import { env } from "./config/env";
import { connectDb, disconnectDb } from "./db/connection";

/**
 * Phase 2 server lifecycle:
 * 1. Connect to MongoDB first (MONGODB_URI is environment-only).
 * 2. Accept requests only after the connection succeeds.
 * 3. Disconnect gracefully on SIGINT/SIGTERM.
 *
 * A missing/unreachable database is fatal with a clear, credential-free
 * error — the API never serves requests it cannot back with data.
 * `/api/health` itself stays database-independent (liveness signal).
 */

async function main(): Promise<void> {
  await connectDb();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`Mero Note API running on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal: string): void => {
    console.log(`Received ${signal} — closing server...`);
    server.close(() => {
      disconnectDb()
        .then(() => {
          console.log("MongoDB disconnected. Shutdown complete.");
          process.exit(0);
        })
        .catch((err: unknown) => {
          console.error("Error during shutdown:", err instanceof Error ? err.message : err);
          process.exit(1);
        });
    });
    // Never hang shutdown on keep-alive connections.
    setTimeout(() => {
      console.error("Shutdown timed out — forcing exit.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
