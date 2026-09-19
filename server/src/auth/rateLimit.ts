import rateLimit from "express-rate-limit";

/**
 * Brute-force guard for credential endpoints (Phase 14).
 * In-memory counters (single instance — noted for Phase 15 scale-out).
 * Rejections reuse the existing {status:"error",message} DTO via `handler`
 * so clients see the same envelope, and successful logins are never counted
 * against the bucket longer than necessary (default reset behavior kept).
 */

function authLimiter(message: string) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { status: "error", message },
  });
}

/** Login + registration share the same budget rationale (credential abuse). */
export const loginLimiter = authLimiter("Too many attempts. Please try again in a minute.");
export const registerLimiter = authLimiter("Too many attempts. Please try again in a minute.");
