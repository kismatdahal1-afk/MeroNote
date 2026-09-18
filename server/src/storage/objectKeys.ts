/**
 * B2 object key strategy: `resources/{resourceId}/{safeFileName}.pdf`
 *
 * Properties:
 * - resource-scoped: one key namespace per resource, deterministic —
 *   re-uploading the same resource overwrites the same key (no orphans on
 *   replace, no collisions between resources).
 * - traversal-proof: the resourceId allowlist and the file-name slugifier
 *   remove directories, `..` segments, absolute paths, and unsafe chars.
 *   User-controlled names can never escape the resource prefix.
 */

const RESOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_KEY_LENGTH = 512;

export class UnsafeKeyError extends Error {
  constructor(reason: string) {
    super(`Unsafe object key input: ${reason}`);
    this.name = "UnsafeKeyError";
  }
}

/** Keep the basename, lowercase, slugify everything outside [a-z0-9._-]. */
export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const withoutExt = base.toLowerCase().endsWith(".pdf") ? base.slice(0, -4) : base;
  const slug = withoutExt
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 120);
  if (!slug) throw new UnsafeKeyError("file name has no usable characters.");
  return `${slug}.pdf`;
}

export function buildResourceKey(resourceId: string, fileName: string): string {
  if (!RESOURCE_ID_PATTERN.test(resourceId)) {
    throw new UnsafeKeyError("resource id must be 1-64 chars of [A-Za-z0-9_-].");
  }
  const key = `resources/${resourceId}/${sanitizeFileName(fileName)}`;
  if (key.length > MAX_KEY_LENGTH) throw new UnsafeKeyError("object key too long.");
  return key;
}
