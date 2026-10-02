import { Router } from "express";
import {
  getCsrfToken,
  googleAuth,
  googleCallback,
  initiateRegistration,
  login,
  logout,
  me,
  refresh,
  register,
  resendRegistrationOtp,
  updateProfile,
} from "../auth/auth.controller";
import { requireAdmin, requireAuth } from "../auth/auth.middleware";
import { requireCsrf } from "../auth/csrf";
import { googleLimiter, loginLimiter, refreshLimiter, registerInitiateLimiter, registerLimiter, registerResendLimiter } from "../auth/rateLimit";
import { asyncHandler } from "../lib/api";

const router = Router();

// F3 public CSRF bootstrap: no session required, issues nothing but the
// readable CSRF cookie. Register/login stay exempt (no victim session
// exists pre-authentication); logout is CSRF-guarded (bumps sessionVersion).
router.get("/csrf", getCsrfToken);
router.post("/register", registerLimiter, asyncHandler(register));
router.post("/login", loginLimiter, asyncHandler(login));
// Step 3 OTP registration (public, pre-session like register/login: no victim
// session exists yet, so no requireCsrf; per-email cooldown + send budget are
// enforced atomically in MongoDB inside the handlers).
router.post("/register/initiate", registerInitiateLimiter, asyncHandler(initiateRegistration));
router.post("/register/resend", registerResendLimiter, asyncHandler(resendRegistrationOtp));
// Step 4: backend Google OAuth (public authorization-code flow). The callback
// is a cross-site GET from Google carrying its own single-use state proof,
// so it stays exempt from requireAuth/requireCsrf like login/register.
router.get("/google", googleLimiter, googleAuth);
router.get("/google/callback", googleLimiter, asyncHandler(googleCallback));
router.post("/logout", requireCsrf, asyncHandler(logout));
// F4 refresh rotation: opaque HttpOnly cookie in, fresh access + child refresh
// out. CSRF-guarded like every cookie-authenticated mutation (its own rate
// budget; never triggers a session refresh cycle itself).
router.post("/refresh", refreshLimiter, requireCsrf, asyncHandler(refresh));
router.get("/me", requireAuth, asyncHandler(me));
// Edit Profile: name only (email immutable, ignored even if sent).
router.patch("/me", requireAuth, requireCsrf, asyncHandler(updateProfile));

// Minimal authorization probe (admin CRUD itself is a later phase).
router.get("/admin/ping", requireAuth, requireAdmin, (_req, res) => {
  res.json({ status: "ok", message: "Admin access confirmed." });
});

export default router;
