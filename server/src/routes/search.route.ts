import { Router } from "express";
import { searchContent } from "../controllers/search.controller";
import { asyncHandler } from "../lib/api";

const router = Router();

// Phase 10 unified search (public read-only; no writes in this phase).
router.get("/", asyncHandler(searchContent));

export default router;
