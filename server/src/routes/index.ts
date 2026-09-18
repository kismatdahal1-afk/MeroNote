import { Router } from "express";
import healthRoute from "./health.route";
import authRoute from "./auth.route";
import semestersRoute from "./semesters.route";
import subjectsRoute from "./subjects.route";
import topicsRoute from "./topics.route";
import resourcesRoute from "./resources.route";
import booksRoute from "./books.route";
import noticesRoute from "./notices.route";

const router = Router();

router.use("/", healthRoute);
router.use("/auth", authRoute);
// Phase 4 academic content API (public reads; no writes in this phase).
router.use("/semesters", semestersRoute);
router.use("/subjects", subjectsRoute);
router.use("/topics", topicsRoute);
router.use("/resources", resourcesRoute);
router.use("/books", booksRoute);
router.use("/notices", noticesRoute);

export default router;
