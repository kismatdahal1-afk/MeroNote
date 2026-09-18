import { Router } from "express";
import { getSubject, listSubjects } from "../controllers/subjects.controller";
import { asyncHandler } from "../lib/api";

const router = Router();

router.get("/", asyncHandler(listSubjects));
router.get("/:id", asyncHandler(getSubject));

export default router;
