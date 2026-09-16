export type ResourceType =
  | "book"
  | "short_note"
  | "handwritten_note"
  | "extra_note"
  | "questions"
  | "important_questions"
  | "hot_topic"
  | "topic"
  | "past_paper"
  | "revision_note"
  | "practical"
  | "custom";

/** CMS publish status shared by all admin-managed entities. */
export type PublishStatus = "draft" | "published" | "hidden";

/** Entities that support soft delete + restore in the CMS trash. */
export type CmsEntity =
  | "semester"
  | "subject"
  | "topic"
  | "resource"
  | "notice"
  | "book";

export interface Semester {
  id: string;
  number: number;
  name: string;
  description: string;
  subjectCount: number;
  resourceCount: number;
  /** total credit hours for the semester */
  credits: number;
  /** Seed/default enrollment state (user status lives in SemesterStatusProvider). */
  enrollment: "passed" | "active" | "upcoming";
  /** Display order in the semester library. */
  order: number;
  status: PublishStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** User-selectable enrollment status (persisted per semester, frontend-only). */
export type SemesterUserStatus = "passed" | "ongoing" | "upcoming";

export interface Subject {
  id: string;
  semesterId: string;
  name: string;
  code: string;
  description: string;
  category: "core" | "elective" | "practical";
  /** credit hours */
  credits: number;
  /** 0..1 offline sync progress */
  offlineSync: number;
  /** frequently repeated board-exam topics */
  hotTopics: string[];
  /** Exam total marks (TU board). Optional — admin-managed. */
  fullMarks?: number;
  status: PublishStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** A syllabus topic inside a subject (admin-managed). */
export interface Topic {
  id: string;
  subjectId: string;
  title: string;
  /** Optional short description. */
  description?: string;
  /** Display order within the subject. */
  order: number;
  /** Publish status — hidden topics are not shown to students. */
  published: boolean;
  status: PublishStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** Program-level info shown on the dashboard greeting banner. */
export interface ProgramInfo {
  university: string;
  program: string;
  /** short batch label, e.g. "Batch '80" */
  batch: string;
  studentLabel: string;
  currentSemesterId: string;
  exam: {
    title: string;
    /** short label, e.g. "Sem V" */
    scope: string;
    date: string;
  };
}

export interface Resource {
  id: string;
  title: string;
  description: string;
  semesterId: string;
  subjectId: string;
  /** Optional topic link — a resource may belong to a syllabus topic. */
  topicId?: string;
  type: ResourceType;
  /** When type is "custom", the admin-entered label. */
  customType?: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  tags: string[];
  uploadedAt: string;
  updatedAt: string;
  /** Optional linked book (books reuse the reader/download system). */
  bookId?: string;
  /** Featured resources are starred for quick access. */
  featured: boolean;
  /** Past-paper specific metadata (optional). */
  paperYear?: number;
  paperFullMarks?: number;
  paperDurationMinutes?: number;
  /** CMS publish status — drafts are not shown to students. */
  status: PublishStatus;
  /** If true, the resource stays published but is invisible to students. */
  hidden: boolean;
  deletedAt?: string;
}

/** Admin-managed book. Lives under Semester + Subject and can be linked
 *  to resources; reading/downloading reuses the resource system. */
export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  edition: string;
  semesterId: string;
  subjectId: string;
  /** Optional resource carrying the actual PDF/file. */
  resourceId?: string;
  pageCount: number;
  /** File size in bytes (for display). */
  fileSize: number;
  status: PublishStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** Dashboard notice/reminder created by the admin. */
export type NoticeType =
  | "exam"
  | "deadline"
  | "assignment"
  | "event"
  | "important"
  | "announcement"
  | "reminder"
  | "general";

export type NoticePriority = "low" | "normal" | "high" | "urgent";

export type NoticeAnnouncer = "administration" | "csit-department" | "examination" | "library";

export interface Notice {
  id: string;
  heading: string;
  subtext: string;
  type: NoticeType;
  /** Who announced the notice. */
  announcer: NoticeAnnouncer;
  /** ISO date the notice refers to (exam day, deadline, event…). */
  date: string;
  priority: NoticePriority;
  status: PublishStatus;
  /** Show on the student dashboard. */
  showOnDashboard: boolean;
  /** Pinned notices stay at the top of the dashboard list. */
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** Activity log entry shown on the Admin Dashboard. */
export interface ActivityEntry {
  id: string;
  entity: CmsEntity;
  action: "create" | "update" | "delete" | "restore" | "publish" | "unpublish" | "hide";
  /** Human label of the affected item, e.g. "DSA Short Notes". */
  label: string;
  at: string;
}

export interface ReadingProgress {
  resourceId: string;
  lastPage: number;
  /** 0..1 */
  progress: number;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  resourceId: string;
  page: number;
  note: string;
  createdAt: string;
}

export interface DownloadItem {
  id: string;
  resourceId: string;
  status: "queued" | "downloading" | "completed" | "failed";
  /** 0..100 */
  progress: number;
  sizeBytes: number;
  downloadedAt: string;
}

export interface RecentEntry {
  resourceId: string;
  openedAt: string;
}

export interface MockUser {
  name: string;
  email: string;
  role: "USER" | "ADMIN";
}

/** Computed day-state of a notice: future → "X Days Remaining",
 *  today → "Today", past → "Completed/Past". */
export type NoticeDayState = "upcoming" | "today" | "past";

export interface NoticeWithState extends Notice {
  /** Remaining days (upcoming) or elapsed days (past); 0 for today. */
  dayCount: number;
  dayState: NoticeDayState;
}
