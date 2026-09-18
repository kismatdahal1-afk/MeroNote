import { Router } from "express";
import { getResource, listResources } from "../controllers/resources.controller";
import { getResourceFile } from "../controllers/resourceFile.controller";
import { asyncHandler } from "../lib/api";

const router = Router();

router.get("/", asyncHandler(listResources));
router.get("/:id/file", asyncHandler(getResourceFile));
router.get("/:id", asyncHandler(getResource));

export default router;
