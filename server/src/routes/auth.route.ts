import { Router } from "express";
import { getCsrfToken, login, logout, me, refresh, register, updateProfile } from "../auth/auth.controller";
import { requireAdmin, requireAuth } from "../auth/auth.middleware";
import { requireCsrf } from "../auth/csrf";
import { loginLimiter, refreshLimiter, registerLimiter } from "../auth/rateLimit";
import { asyncHandler } from "../lib/api";

const router = Router();

// F3 public CSRF bootstrap: no session required, issues nothing but the
// readable CSRF cookie. Register/login stay exempt (no victim session
// exists pre-authentication); logout is CSRF-guarded (bumps sessionVersion).
router.get("/csrf", getCsrfToken);
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/logout", requireCsrf, logout);
// F4 refresh rotation: opaque HttpOnly cookie in, fresh access + child refresh
// out. CSRF-guarded like every cookie-authenticated mutation (its own rate
// budget; never triggers a session refresh cycle itself).
router.post("/refresh", refreshLimiter, requireCsrf, refresh);
router.get("/me", requireAuth, me);
// Edit Profile: name only (email immutable, ignored even if sent).
router.patch("/me", requireAuth, requireCsrf, asyncHandler(updateProfile));

// Minimal authorization probe (admin CRUD itself is a later phase).
router.get("/admin/ping", requireAuth, requireAdmin, (_req, res) => {
  res.json({ status: "ok", message: "Admin access confirmed." });
});

export default router;
