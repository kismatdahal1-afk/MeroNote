import mongoose from "mongoose";
import { env } from "../config/env";

/**
 * Phase 1 MongoDB connection layer (Mongoose — ratified per
 * docs/backend-architecture.md §22, decision 1 + Phase 1 boundary).
 *
 * Rules:
 * - URI comes only from the MONGODB_URI environment variable. Never hardcoded.
 * - Safe to call multiple times: reuses the existing connection.
 * - Throws a clear error when the URI is missing or the connection fails;
 *   never silently falls back to another database.
 */

let connecting: Promise<typeof mongoose> | null = null;

export async function connectDb(uri: string = env.mongodbUri): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connecting) return connecting;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy server/.env.example to server/.env and set MONGODB_URI (never commit secrets).",
    );
  }

  // Fail fast on unreachable hosts instead of hanging boot (10s).
  connecting = mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 }).catch((err: unknown) => {
    connecting = null;
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to connect to MongoDB: ${reason}`);
  });

  return connecting;
}

export async function disconnectDb(): Promise<void> {
  connecting = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
