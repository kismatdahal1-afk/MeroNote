import bcrypt from "bcryptjs";

/**
 * Password hashing (bcryptjs, cost 12 — ratified Phase 3 decision).
 * Pure-JS implementation: no native build step on any platform.
 * Plain-text passwords are never stored and never logged.
 */

const COST_FACTOR = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST_FACTOR);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!password || !passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}
