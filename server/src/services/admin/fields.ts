import { AdminError } from "./errors";

/**
 * Phase 11 body readers. Every reader trims strings and throws
 * AdminError(400) on violation — controllers map it, nothing leaks.
 * Unknown body fields are ignored (updates are built from allowlists).
 */

export type Body = Record<string, unknown>;

export function bodyOf(req: { body?: unknown }): Body {
  return typeof req.body === "object" && req.body !== null ? (req.body as Body) : {};
}

function strLen(field: string, value: string, min: number, max: number): void {
  if (value.length < min || value.length > max) {
    throw new AdminError(400, `Field '${field}' must be ${min}–${max} characters.`);
  }
}

export function reqString(body: Body, field: string, min = 1, max = 2000): string {
  const value = body[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new AdminError(400, `Field '${field}' is required.`);
  }
  const trimmed = value.trim();
  strLen(field, trimmed, min, max);
  return trimmed;
}

export function optString(body: Body, field: string, max = 2000): string | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new AdminError(400, `Field '${field}' must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  strLen(field, trimmed, 1, max);
  return trimmed;
}

export function reqEnum<T extends string>(body: Body, field: string, values: readonly T[]): T {
  const value = body[field];
  if (typeof value !== "string" || !(values as readonly string[]).includes(value)) {
    throw new AdminError(400, `Field '${field}' must be one of: ${values.join(", ")}.`);
  }
  return value as T;
}

export function optEnum<T extends string>(body: Body, field: string, values: readonly T[]): T | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  return reqEnum({ [field]: value }, field, values);
}

function numRange(field: string, value: number, min?: number, max?: number): void {
  if (!Number.isFinite(value)) throw new AdminError(400, `Field '${field}' must be a number.`);
  if (min !== undefined && value < min) throw new AdminError(400, `Field '${field}' must be at least ${min}.`);
  if (max !== undefined && value > max) throw new AdminError(400, `Field '${field}' must be at most ${max}.`);
}

function toNumber(body: Body, field: string): number | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== "number") throw new AdminError(400, `Field '${field}' must be a number.`);
  return value;
}

export function reqNumber(body: Body, field: string, min?: number, max?: number): number {
  const value = toNumber(body, field);
  if (value === undefined) throw new AdminError(400, `Field '${field}' is required.`);
  numRange(field, value, min, max);
  return value;
}

export function optNumber(body: Body, field: string, min?: number, max?: number): number | undefined {
  const value = toNumber(body, field);
  if (value === undefined) return undefined;
  numRange(field, value, min, max);
  return value;
}

export function reqInt(body: Body, field: string, min?: number, max?: number): number {
  const value = reqNumber(body, field, min, max);
  if (!Number.isInteger(value)) throw new AdminError(400, `Field '${field}' must be an integer.`);
  return value;
}

export function optInt(body: Body, field: string, min?: number, max?: number): number | undefined {
  const value = optNumber(body, field, min, max);
  if (value === undefined) return undefined;
  if (!Number.isInteger(value)) throw new AdminError(400, `Field '${field}' must be an integer.`);
  return value;
}

export function reqBoolean(body: Body, field: string): boolean {
  const value = body[field];
  if (typeof value !== "boolean") throw new AdminError(400, `Field '${field}' must be true or false.`);
  return value;
}

export function optBoolean(body: Body, field: string): boolean | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new AdminError(400, `Field '${field}' must be true or false.`);
  return value;
}

export function optStringArray(
  body: Body,
  field: string,
  maxItems: number,
  maxLen: number,
  lowercase = false,
): string[] | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new AdminError(400, `Field '${field}' must be an array of strings.`);
  if (value.length > maxItems) throw new AdminError(400, `Field '${field}' must have at most ${maxItems} entries.`);
  const cleaned = value.map((entry) => {
    if (typeof entry !== "string" || !entry.trim()) {
      throw new AdminError(400, `Field '${field}' must contain non-empty strings.`);
    }
    const text = lowercase ? entry.trim().toLowerCase() : entry.trim();
    if (text.length > maxLen) throw new AdminError(400, `Field '${field}' entries must be at most ${maxLen} characters.`);
    return text;
  });
  return [...new Set(cleaned)];
}

export function reqDate(body: Body, field: string): Date {
  const value = body[field];
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new AdminError(400, `Field '${field}' must be a valid date string.`);
  }
  return new Date(value);
}

export function optDate(body: Body, field: string): Date | undefined {
  if (body[field] === undefined) return undefined;
  return reqDate(body, field);
}
