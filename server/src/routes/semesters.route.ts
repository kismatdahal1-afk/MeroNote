import { Router } from "express";
import { getSemester, listSemesters } from "../controllers/semesters.controller";
import { asyncHandler } from "../lib/api";

const router = Router();

router.get("/", asyncHandler(listSemesters));
router.get("/:id", asyncHandler(getSemester));

export default router;
