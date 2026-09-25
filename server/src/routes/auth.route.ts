import { Router } from "express";
import { login, logout, me, register, updateProfile } from "../auth/auth.controller";
import { requireAdmin, requireAuth } from "../auth/auth.middleware";
import { loginLimiter, registerLimiter } from "../auth/rateLimit";
import { asyncHandler } from "../lib/api";

const router = Router();

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
// Edit Profile: name only (email immutable, ignored even if sent).
router.patch("/me", requireAuth, asyncHandler(updateProfile));

// Minimal authorization probe (admin CRUD itself is a later phase).
router.get("/admin/ping", requireAuth, requireAdmin, (_req, res) => {
  res.json({ status: "ok", message: "Admin access confirmed." });
});

export default router;
