import { Router } from "express";
import { login, logout, me, register } from "../auth/auth.controller";
import { requireAdmin, requireAuth } from "../auth/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

// Minimal authorization probe (admin CRUD itself is a later phase).
router.get("/admin/ping", requireAuth, requireAdmin, (_req, res) => {
  res.json({ status: "ok", message: "Admin access confirmed." });
});

export default router;
