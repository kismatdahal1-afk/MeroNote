import { Router } from "express";
import { getTopic, listTopics } from "../controllers/topics.controller";
import { asyncHandler } from "../lib/api";

const router = Router();

router.get("/", asyncHandler(listTopics));
router.get("/:id", asyncHandler(getTopic));

export default router;
