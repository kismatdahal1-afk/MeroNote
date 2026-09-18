import { Router } from "express";
import { getNotice, listNotices } from "../controllers/notices.controller";
import { asyncHandler } from "../lib/api";

const router = Router();

router.get("/", asyncHandler(listNotices));
router.get("/:id", asyncHandler(getNotice));

export default router;
