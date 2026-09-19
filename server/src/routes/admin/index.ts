import { Router, type Request, type Response } from "express";
import { requireAuth, requireAdmin } from "../../auth/auth.middleware";
import { asyncHandler } from "../../lib/api";
import { uploadSinglePdf } from "../../middleware/upload.middleware";
import {
  createSemester,
  deleteSemester,
  getSemester,
  listSemesters,
  restoreSemester,
  updateSemester,
} from "../../controllers/admin/semesters.controller";
import {
  createSubject,
  deleteSubject,
  getSubject,
  listSubjects,
  restoreSubject,
  updateSubject,
} from "../../controllers/admin/subjects.controller";
import {
  createTopic,
  deleteTopic,
  getTopic,
  listTopics,
  restoreTopic,
  updateTopic,
} from "../../controllers/admin/topics.controller";
import {
  createBook,
  deleteBook,
  getBook,
  listBooks,
  restoreBook,
  updateBook,
} from "../../controllers/admin/books.controller";
import {
  createNotice,
  deleteNotice,
  getNotice,
  listNotices,
  restoreNotice,
  updateNotice,
} from "../../controllers/admin/notices.controller";
import {
  createResource,
  deleteResource,
  deleteResourcePdf,
  getResource,
  listResources,
  restoreResource,
  updateResource,
  uploadResourcePdf,
} from "../../controllers/admin/resources.controller";

const router = Router();

// Every CMS route is ADMIN-only. Student reads stay on the public routers.
router.use(requireAuth, requireAdmin);

type AdminHandler = (req: Request, res: Response) => Promise<void>;

function crud(
  target: Router,
  handlers: { list: AdminHandler; get: AdminHandler; create: AdminHandler; update: AdminHandler; remove: AdminHandler; restore: AdminHandler },
): void {
  target.get("/", asyncHandler(handlers.list));
  target.get("/:id", asyncHandler(handlers.get));
  target.post("/", asyncHandler(handlers.create));
  target.patch("/:id", asyncHandler(handlers.update));
  target.delete("/:id", asyncHandler(handlers.remove));
  target.post("/:id/restore", asyncHandler(handlers.restore));
}

const semesters = Router();
crud(semesters, {
  list: listSemesters,
  get: getSemester,
  create: createSemester,
  update: updateSemester,
  remove: deleteSemester,
  restore: restoreSemester,
});

const subjects = Router();
crud(subjects, {
  list: listSubjects,
  get: getSubject,
  create: createSubject,
  update: updateSubject,
  remove: deleteSubject,
  restore: restoreSubject,
});

const topics = Router();
crud(topics, {
  list: listTopics,
  get: getTopic,
  create: createTopic,
  update: updateTopic,
  remove: deleteTopic,
  restore: restoreTopic,
});

const books = Router();
crud(books, {
  list: listBooks,
  get: getBook,
  create: createBook,
  update: updateBook,
  remove: deleteBook,
  restore: restoreBook,
});

const notices = Router();
crud(notices, {
  list: listNotices,
  get: getNotice,
  create: createNotice,
  update: updateNotice,
  remove: deleteNotice,
  restore: restoreNotice,
});

const resources = Router();
crud(resources, {
  list: listResources,
  get: getResource,
  create: createResource,
  update: updateResource,
  remove: deleteResource,
  restore: restoreResource,
});
// Multer runs as middleware (it answers its own errors without next()).
resources.post("/:id/file", uploadSinglePdf, asyncHandler(uploadResourcePdf));
resources.delete("/:id/file", asyncHandler(deleteResourcePdf));

router.use("/semesters", semesters);
router.use("/subjects", subjects);
router.use("/topics", topics);
router.use("/books", books);
router.use("/notices", notices);
router.use("/resources", resources);

export default router;
