import { env } from "../src/config/env";
import { isB2Placeholder } from "../src/storage/b2.client";

/**
 * Shared B2 credential gate for verification scripts (test-only helper).
 * Mirrors requireB2Config's fail-closed rules without throwing:
 *
 * - `b2CredsPresent`: trio is non-blank (legacy meaning, kept for messages).
 * - `b2PlaceholdersPresent`: any non-blank trio value is a `<...>` template marker.
 * - `b2CredsUsable`: real credentials — the ONLY condition that may touch
 *   live B2. A placeholder `.env` stays on the offline tier everywhere.
 */

const trio = (): string[] => [env.b2KeyId, env.b2ApplicationKey, env.b2BucketName];

export function b2CredsPresent(): boolean {
  return trio().every((v) => v.trim() !== "");
}

export function b2PlaceholdersPresent(): boolean {
  return trio().some((v) => v.trim() !== "" && isB2Placeholder(v));
}

export function b2CredsUsable(): boolean {
  return b2CredsPresent() && !b2PlaceholdersPresent();
}
