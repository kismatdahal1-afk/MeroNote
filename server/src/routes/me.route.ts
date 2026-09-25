import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { asyncHandler } from "../lib/api";
import { deleteFavorite, listFavorites, putFavorite } from "../controllers/favorites.controller";
import { createBookmark, deleteBookmark, listBookmarks, updateBookmark } from "../controllers/bookmarks.controller";
import { getProgress, listProgress, putProgress } from "../controllers/progress.controller";
import { listSemesterPlan, patchSemesterPlan } from "../controllers/semesterPlan.controller";
import { listDownloads, putDownload } from "../controllers/downloads.controller";

const router = Router();

// All personal study data requires authentication; ownership always derives
// from req.user (never from client-supplied userId).
router.use(requireAuth);

router.get("/favorites", asyncHandler(listFavorites));
router.put("/favorites/:targetType/:targetId", asyncHandler(putFavorite));
router.delete("/favorites/:targetType/:targetId", asyncHandler(deleteFavorite));

router.get("/bookmarks", asyncHandler(listBookmarks));
router.post("/bookmarks", asyncHandler(createBookmark));
router.patch("/bookmarks/:id", asyncHandler(updateBookmark));
router.delete("/bookmarks/:id", asyncHandler(deleteBookmark));

router.get("/progress", asyncHandler(listProgress));
router.get("/progress/:resourceId", asyncHandler(getProgress));
router.put("/progress/:resourceId", asyncHandler(putProgress));

router.get("/semester-plan", asyncHandler(listSemesterPlan));
router.patch("/semester-plan/:semesterId", asyncHandler(patchSemesterPlan));

router.get("/downloads", asyncHandler(listDownloads));
router.put("/downloads/:resourceId", asyncHandler(putDownload));

export default router;
