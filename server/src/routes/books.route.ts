import { Router } from "express";
import { getBook, listBooks } from "../controllers/books.controller";
import { asyncHandler } from "../lib/api";

const router = Router();

router.get("/", asyncHandler(listBooks));
router.get("/:id", asyncHandler(getBook));

export default router;
