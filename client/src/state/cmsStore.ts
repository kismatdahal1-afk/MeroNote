import type {
  ActivityEntry,
  Book,
  CmsEntity,
  Notice,
  NoticeWithState,
  Resource,
  Semester,
  Subject,
  Topic,
} from "../types";
import {
  programInfo,
  resources as seedResources,
  semesters as seedSemesters,
  subjects as seedSubjects,
  topics as seedTopics,
} from "../data/mock";

/**
 * Frontend CMS "database" (Phase-2.5 stand-in for the real API).
 *
 * Collections are seeded from data/mock and persisted to localStorage.
 * All admin CRUD flows through the mutation functions here so every
 * consumer (student pages + selectors) sees consistent data. When the
 * real API arrives, this module is the single place to swap storage
 * for fetch calls.
 */

const STORAGE_KEY = "meronote-cms-db-v1";
/** One-time migration flag: clear seed-era featured flags (Featured board removed). */
const MIGRATION_KEY = `${STORAGE_KEY}-migrated-unfeature-v1`;

export interface CmsDb {
  semesters: Semester[];
  subjects: Subject[];
  topics: Topic[];
  resources: Resource[];
  books: Book[];
  notices: Notice[];
  activity: ActivityEntry[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const nowIso = () => new Date().toISOString();

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nextId(prefix: string, db: CmsDb): string {
  let n = 1;
  while (`${prefix}-${n}` in index(db)) n++;
  return `${prefix}-${n}`;
}

function index(db: CmsDb): Record<string, true> {
  const out: Record<string, true> = {};
  for (const list of [db.semesters, db.subjects, db.topics, db.resources, db.books, db.notices, db.activity]) {
    for (const item of list as { id: string }[]) out[item.id] = true;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

/** Upgrade seed/mock entities into full CMS records. */
function seedDb(): CmsDb {
  const semesters = copy(seedSemesters).map((s, i) => ({
    ...s,
    order: i + 1,
    status: "published" as const,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })) as Semester[];

  const subjects = copy(seedSubjects).map((s) => ({
    ...s,
    status: "published" as const,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })) as Subject[];

  const topics = copy(seedTopics).map((t) => ({
    ...t,
    status: t.published ? ("published" as const) : ("draft" as const),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })) as Topic[];

  const resources = copy(seedResources).map((r) => ({
    ...r,
    featured: false,
    status: "published" as const,
  })) as Resource[];

  /** A couple of starter notices so the dashboard has real content. */
  const notices: Notice[] = [
    {
      id: "notice-1",
      heading: "TU Board Exam — Sem IV",
      subtext: "Admit cards are available from the department office. Bring your student ID.",
      type: "exam",
      date: new Date(Date.now() + 24 * 24 * 60 * 60 * 1000).toISOString(),
      priority: "high",
      status: "published",
      showOnDashboard: true,
      pinned: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "notice-2",
      heading: "DBMS Assignment 3 Deadline",
      subtext: "Submit normalization exercises via the department portal before 5 PM.",
      type: "deadline",
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      semesterId: "sem-4",
      subjectId: "sub-dbms",
      priority: "normal",
      status: "published",
      showOnDashboard: true,
      pinned: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "notice-3",
      heading: "Library Hours Extended",
      subtext: "Reading room stays open until 8 PM during the exam period.",
      type: "announcement",
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      priority: "low",
      status: "published",
      showOnDashboard: true,
      pinned: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];

  const activity: ActivityEntry[] = resources
    .slice()
    .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
    .slice(0, 5)
    .map((r) => ({
      id: `act-seed-${r.id}`,
      entity: "resource" as const,
      action: "create" as const,
      label: r.title,
      at: r.uploadedAt,
    }));

  return { semesters, subjects, topics, resources, books: [], notices, activity };
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function loadDb(): CmsDb {
  if (typeof window === "undefined") return seedDb();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedDb();
    const parsed = JSON.parse(raw) as CmsDb;
    if (
      parsed &&
      Array.isArray(parsed.semesters) &&
      Array.isArray(parsed.subjects) &&
      Array.isArray(parsed.topics) &&
      Array.isArray(parsed.resources) &&
      Array.isArray(parsed.notices)
    ) {
      const needsUnfeatureMigration =
        window.localStorage.getItem(MIGRATION_KEY) !== "1";
      return {
        semesters: parsed.semesters,
        subjects: parsed.subjects,
        topics: parsed.topics,
        resources: needsUnfeatureMigration
          ? parsed.resources.map((r) => ({ ...r, featured: false }))
          : parsed.resources,
        books: parsed.books ?? [],
        notices: parsed.notices,
        activity: parsed.activity ?? [],
      };
    }
  } catch {
    // Corrupt storage — fall through to reseed.
  }
  return seedDb();
}

function persist(db: CmsDb): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage unavailable — keep in-memory only.
  }
}

/* ------------------------------------------------------------------ */
/* Observable store                                                    */
/* ------------------------------------------------------------------ */

type Listener = (db: CmsDb) => void;

let db: CmsDb = loadDb();
const listeners = new Set<Listener>();

// Run once on boot: if the loaded DB had legacy featured flags cleared above,
// persist the result and mark the migration done.
if (typeof window !== "undefined" && window.localStorage.getItem(MIGRATION_KEY) !== "1") {
  persist(db);
  try {
    window.localStorage.setItem(MIGRATION_KEY, "1");
  } catch {
    // Storage unavailable — in-memory only.
  }
}

function commit(): void {
  persist(db);
  for (const l of listeners) l(db);
}

/** Subscribe to any CMS change. Returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current snapshot (read-only by convention). */
export function getDb(): CmsDb {
  return db;
}

/** Reset to seeded state (used by Trash "empty trash" and dev resets). */
export function resetDb(): void {
  db = seedDb();
  commit();
}

/* ------------------------------------------------------------------ */
/* Activity log                                                        */
/* ------------------------------------------------------------------ */

function logActivity(entity: CmsEntity, action: ActivityEntry["action"], label: string): void {
  db.activity = [
    { id: nextId("act", db), entity, action, label, at: nowIso() },
    ...db.activity,
  ].slice(0, 50);
}

/* ------------------------------------------------------------------ */
/* Generic entity helpers                                              */
/* ------------------------------------------------------------------ */

interface SoftDeletable {
  id: string;
  deletedAt?: string;
}

function collection(entity: CmsEntity): SoftDeletable[] {
  switch (entity) {
    case "semester": return db.semesters;
    case "subject": return db.subjects;
    case "topic": return db.topics;
    case "resource": return db.resources;
    case "notice": return db.notices;
    case "book": return db.books;
  }
}

/** Soft delete: marks deletedAt and removes children's visibility by cascade. */
export function softDelete(entity: CmsEntity, id: string): void {
  const item = collection(entity).find((x) => x.id === id);
  if (!item || item.deletedAt) return;
  item.deletedAt = nowIso();
  logActivity(entity, "delete", labelOf(entity, item));
  commit();
}

/** Undo soft delete. */
export function restoreEntity(entity: CmsEntity, id: string): void {
  const item = collection(entity).find((x) => x.id === id);
  if (!item || !item.deletedAt) return;
  delete item.deletedAt;
  logActivity(entity, "restore", labelOf(entity, item));
  commit();
}

/** Permanent delete with cascades to children. */
export function purgeEntity(entity: CmsEntity, id: string): void {
  switch (entity) {
    case "semester":
      for (const s of db.subjects.filter((s) => s.semesterId === id)) purgeEntity("subject", s.id);
      db.semesters = db.semesters.filter((s) => s.id !== id);
      break;
    case "subject":
      for (const t of db.topics.filter((t) => t.subjectId === id)) purgeEntity("topic", t.id);
      for (const r of db.resources.filter((r) => r.subjectId === id)) purgeEntity("resource", r.id);
      for (const b of db.books.filter((b) => b.subjectId === id)) purgeEntity("book", b.id);
      db.subjects = db.subjects.filter((s) => s.id !== id);
      break;
    case "topic":
      for (const r of db.resources.filter((r) => r.topicId === id)) {
        delete r.topicId;
      }
      db.topics = db.topics.filter((t) => t.id !== id);
      break;
    case "resource": {
      const res = db.resources.find((r) => r.id === id);
      if (res) {
        for (const b of db.books) if (b.resourceId === id) delete b.resourceId;
        for (const r of db.resources.filter((x) => x.id !== id && x.bookId === id)) delete r.bookId;
      }
      db.resources = db.resources.filter((r) => r.id !== id);
      break;
    }
    case "notice":
      db.notices = db.notices.filter((n) => n.id !== id);
      break;
    case "book":
      for (const r of db.resources.filter((r) => r.bookId === id)) delete r.bookId;
      db.books = db.books.filter((b) => b.id !== id);
      break;
  }
  logActivity(entity, "delete", id);
  commit();
}

function labelOf(_entity: CmsEntity, item: SoftDeletable): string {
  const it = item as unknown as Record<string, unknown>;
  return String(it.title ?? it.name ?? it.heading ?? item.id);
}

/** Permanently remove every soft-deleted item of an entity type (or all). */
export function emptyTrash(entity?: CmsEntity): void {
  const entities: CmsEntity[] = entity ? [entity] : ["semester", "subject", "topic", "resource", "notice", "book"];
  for (const e of entities) {
    const list = collection(e).filter((x) => x.deletedAt);
    for (const item of list) purgeEntity(e, item.id);
  }
  commit();
}

/* ------------------------------------------------------------------ */
/* Semesters                                                           */
/* ------------------------------------------------------------------ */

export interface SemesterDraft {
  name: string;
  description: string;
  order: number;
  status: Semester["status"];
}

export function createSemester(draft: SemesterDraft): Semester {
  const item: Semester = {
    id: nextId("sem", db),
    number: db.semesters.length + 1,
    name: draft.name,
    description: draft.description,
    subjectCount: 0,
    resourceCount: 0,
    credits: 0,
    enrollment: "upcoming",
    order: draft.order || db.semesters.length + 1,
    status: draft.status,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.semesters = [...db.semesters, item];
  logActivity("semester", "create", item.name);
  commit();
  return item;
}

export function updateSemester(id: string, patch: Partial<SemesterDraft>): void {
  const item = db.semesters.find((s) => s.id === id);
  if (!item) return;
  Object.assign(item, patch, { updatedAt: nowIso() });
  logActivity("semester", "update", item.name);
  commit();
}

/** Swap order values of two semesters (reorder arrows in admin list). */
export function reorderSemesters(id: string, direction: -1 | 1): void {
  const alive = db.semesters.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order);
  const i = alive.findIndex((s) => s.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= alive.length) return;
  const a = alive[i];
  const b = alive[j];
  [a.order, b.order] = [b.order, a.order];
  db.semesters = [...db.semesters];
  commit();
}

export function setSemesterStatus(id: string, status: Semester["status"]): void {
  const item = db.semesters.find((s) => s.id === id);
  if (!item) return;
  item.status = status;
  item.updatedAt = nowIso();
  logActivity("semester", status === "published" ? "publish" : "unpublish", item.name);
  commit();
}

/** Same fork semantics as branchResourceToDraft — see there. */
export function branchSemesterToDraft(id: string, patch: Partial<SemesterDraft>): Semester | undefined {
  const item = db.semesters.find((s) => s.id === id);
  if (!item) return undefined;
  const copyItem: Semester = {
    ...copy(item),
    id: nextId("sem", db),
    ...patch,
    createdAt: item.createdAt,
    updatedAt: nowIso(),
    status: "draft",
  };
  db.semesters = [...db.semesters, copyItem];
  logActivity("semester", "create", copyItem.name);
  commit();
  return copyItem;
}

/* ------------------------------------------------------------------ */
/* Subjects                                                            */
/* ------------------------------------------------------------------ */

export interface SubjectDraft {
  semesterId: string;
  name: string;
  code: string;
  description: string;
  category: Subject["category"];
  credits: number;
  fullMarks?: number;
  hotTopics?: string[];
  status: Subject["status"];
}

export function createSubject(draft: SubjectDraft): Subject {
  const item: Subject = {
    id: nextId("sub", db),
    semesterId: draft.semesterId,
    name: draft.name,
    code: draft.code,
    description: draft.description,
    category: draft.category,
    credits: draft.credits,
    offlineSync: 0,
    hotTopics: draft.hotTopics ?? [],
    fullMarks: draft.fullMarks,
    status: draft.status,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.subjects = [...db.subjects, item];
  logActivity("subject", "create", item.name);
  commit();
  return item;
}

export function updateSubject(id: string, patch: Partial<SubjectDraft>): void {
  const item = db.subjects.find((s) => s.id === id);
  if (!item) return;
  Object.assign(item, patch, { updatedAt: nowIso() });
  logActivity("subject", "update", item.name);
  commit();
}

export function setSubjectStatus(id: string, status: Subject["status"]): void {
  const item = db.subjects.find((s) => s.id === id);
  if (!item) return;
  item.status = status;
  item.updatedAt = nowIso();
  logActivity("subject", status === "published" ? "publish" : "unpublish", item.name);
  commit();
}

/* ------------------------------------------------------------------ */
/* Topics                                                              */
/* ------------------------------------------------------------------ */

export interface TopicDraft {
  subjectId: string;
  title: string;
  description: string;
  order: number;
  status: Topic["status"];
}

export function createTopic(draft: TopicDraft): Topic {
  const item: Topic = {
    id: nextId("top", db),
    subjectId: draft.subjectId,
    title: draft.title,
    description: draft.description || undefined,
    order: draft.order,
    published: draft.status === "published",
    status: draft.status,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.topics = [...db.topics, item];
  logActivity("topic", "create", item.title);
  commit();
  return item;
}

export function updateTopic(id: string, patch: Partial<TopicDraft>): void {
  const item = db.topics.find((t) => t.id === id);
  if (!item) return;
  Object.assign(item, patch, { updatedAt: nowIso() });
  if (patch.status) {
    item.published = patch.status === "published";
  }
  logActivity("topic", "update", item.title);
  commit();
}

/** Same fork semantics as branchResourceToDraft — see there. */
export function branchTopicToDraft(id: string, patch: Partial<TopicDraft>): Topic | undefined {
  const item = db.topics.find((t) => t.id === id);
  if (!item) return undefined;
  const copyItem: Topic = {
    ...copy(item),
    id: nextId("top", db),
    ...patch,
    published: false,
    createdAt: item.createdAt,
    updatedAt: nowIso(),
    status: "draft",
  };
  db.topics = [...db.topics, copyItem];
  logActivity("topic", "create", copyItem.title);
  commit();
  return copyItem;
}

export function reorderTopics(id: string, direction: -1 | 1): void {
  const topic = db.topics.find((t) => t.id === id);
  if (!topic || topic.deletedAt) return;
  const siblings = db.topics
    .filter((t) => t.subjectId === topic.subjectId && !t.deletedAt)
    .sort((a, b) => a.order - b.order);
  const i = siblings.findIndex((t) => t.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= siblings.length) return;
  const a = siblings[i];
  const b = siblings[j];
  [a.order, b.order] = [b.order, a.order];
  db.topics = [...db.topics];
  commit();
}

/* ------------------------------------------------------------------ */
/* Books                                                               */
/* ------------------------------------------------------------------ */

export interface BookDraft {
  title: string;
  author: string;
  description: string;
  edition: string;
  semesterId: string;
  subjectId: string;
  resourceId?: string;
  pageCount: number;
  fileSize: number;
  status: Book["status"];
}

export function createBook(draft: BookDraft): Book {
  const item: Book = {
    id: nextId("bk", db),
    title: draft.title,
    author: draft.author,
    description: draft.description,
    edition: draft.edition,
    semesterId: draft.semesterId,
    subjectId: draft.subjectId,
    resourceId: draft.resourceId,
    pageCount: draft.pageCount,
    fileSize: draft.fileSize,
    status: draft.status,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.books = [...db.books, item];
  logActivity("book", "create", item.title);
  commit();
  return item;
}

export function updateBook(id: string, patch: Partial<BookDraft>): void {
  const item = db.books.find((b) => b.id === id);
  if (!item) return;
  Object.assign(item, patch, { updatedAt: nowIso() });
  logActivity("book", "update", item.title);
  commit();
}

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

export interface ResourceDraft {
  title: string;
  description: string;
  semesterId: string;
  subjectId: string;
  topicId?: string;
  bookId?: string;
  type: Resource["type"];
  fileName: string;
  fileSize: number;
  pageCount: number;
  tags: string[];
  featured?: boolean;
  paperYear?: number;
  paperFullMarks?: number;
  paperDurationMinutes?: number;
  status: Resource["status"];
}

/** Create a resource. When `draft.file` metadata (name/size) is present it is
 *  used directly; editing never requires re-uploading a file. */
export function createResource(draft: ResourceDraft): Resource {
  const item: Resource = {
    id: nextId("res", db),
    title: draft.title,
    description: draft.description,
    semesterId: draft.semesterId,
    subjectId: draft.subjectId,
    topicId: draft.topicId,
    bookId: draft.bookId,
    type: draft.type,
    fileName: draft.fileName,
    fileSize: draft.fileSize,
    pageCount: draft.pageCount,
    tags: draft.tags,
    uploadedAt: nowIso(),
    updatedAt: nowIso(),
    featured: draft.featured ?? false,
    paperYear: draft.paperYear,
    paperFullMarks: draft.paperFullMarks,
    paperDurationMinutes: draft.paperDurationMinutes,
    status: draft.status,
  };
  db.resources = [...db.resources, item];
  logActivity("resource", "create", item.title);
  commit();
  return item;
}

export function updateResource(id: string, patch: Partial<ResourceDraft>): void {
  const item = db.resources.find((r) => r.id === id);
  if (!item) return;
  Object.assign(item, patch, { updatedAt: nowIso() });
  logActivity("resource", "update", item.title);
  commit();
}

export function setResourceStatus(id: string, status: Resource["status"]): void {
  const item = db.resources.find((r) => r.id === id);
  if (!item) return;
  item.status = status;
  item.updatedAt = nowIso();
  logActivity("resource", status === "published" ? "publish" : "unpublish", item.title);
  commit();
}

/**
 * Editing a non-draft (published/hidden) item and choosing "Save as Draft"
 * must NOT overwrite the live version. Instead: keep the original untouched
 * and stage the edited content as a NEW draft copy in Drafts.
 * (Editing an existing draft just updates it — see updateResource.)
 */
export function branchResourceToDraft(id: string, patch: Partial<ResourceDraft>): Resource | undefined {
  const item = db.resources.find((r) => r.id === id);
  if (!item) return undefined;
  const copyItem: Resource = {
    ...copy(item),
    id: nextId("res", db),
    ...patch,
    uploadedAt: item.uploadedAt,
    updatedAt: nowIso(),
    status: "draft",
  };
  db.resources = [...db.resources, copyItem];
  logActivity("resource", "create", copyItem.title);
  commit();
  return copyItem;
}

export function toggleResourceFeatured(id: string): void {
  const item = db.resources.find((r) => r.id === id);
  if (!item) return;
  item.featured = !item.featured;
  item.updatedAt = nowIso();
  logActivity("resource", "update", item.title);
  commit();
}

/* ------------------------------------------------------------------ */
/* Notices                                                             */
/* ------------------------------------------------------------------ */

export interface NoticeDraft {
  heading: string;
  subtext: string;
  type: Notice["type"];
  date: string;
  semesterId?: string;
  subjectId?: string;
  priority: Notice["priority"];
  status: Notice["status"];
  showOnDashboard: boolean;
  pinned: boolean;
}

export function createNotice(draft: NoticeDraft): Notice {
  const item: Notice = {
    id: nextId("notice", db),
    heading: draft.heading,
    subtext: draft.subtext,
    type: draft.type,
    date: draft.date,
    semesterId: draft.semesterId,
    subjectId: draft.subjectId,
    priority: draft.priority,
    status: draft.status,
    showOnDashboard: draft.showOnDashboard,
    pinned: draft.pinned,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.notices = [...db.notices, item];
  logActivity("notice", "create", item.heading);
  commit();
  return item;
}

export function updateNotice(id: string, patch: Partial<NoticeDraft>): void {
  const item = db.notices.find((n) => n.id === id);
  if (!item) return;
  Object.assign(item, patch, { updatedAt: nowIso() });
  logActivity("notice", "update", item.heading);
  commit();
}

export function setNoticeStatus(id: string, status: Notice["status"]): void {
  const item = db.notices.find((n) => n.id === id);
  if (!item) return;
  item.status = status;
  item.updatedAt = nowIso();
  logActivity("notice", status === "published" ? "publish" : "unpublish", item.heading);
  commit();
}

/** Same fork semantics as branchResourceToDraft — see there. */
export function branchNoticeToDraft(id: string, patch: Partial<NoticeDraft>): Notice | undefined {
  const item = db.notices.find((n) => n.id === id);
  if (!item) return undefined;
  const copyItem: Notice = {
    ...copy(item),
    id: nextId("notice", db),
    ...patch,
    createdAt: item.createdAt,
    updatedAt: nowIso(),
    status: "draft",
  };
  db.notices = [...db.notices, copyItem];
  logActivity("notice", "create", copyItem.heading);
  commit();
  return copyItem;
}

export function toggleNoticePinned(id: string): void {
  const item = db.notices.find((n) => n.id === id);
  if (!item) return;
  item.pinned = !item.pinned;
  item.updatedAt = nowIso();
  commit();
}

/* ------------------------------------------------------------------ */
/* Tags                                                                */
/* ------------------------------------------------------------------ */

/** All unique tags in use across live resources, with usage counts. */
export function getAllTags(): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of db.resources) {
    if (r.deletedAt || r.status !== "published") continue;
    for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Rename a tag everywhere it is used (live + trashed resources). */
export function renameTag(from: string, to: string): void {
  const clean = to.trim().toLowerCase();
  if (!clean || clean === from) return;
  for (const r of db.resources) {
    if (!r.tags.includes(from)) continue;
    r.tags = r.tags
      .filter((t) => t !== from)
      .concat(clean)
      .filter((t, i, arr) => arr.indexOf(t) === i);
  }
  db.resources = [...db.resources];
  commit();
}

/** Delete a tag from every resource. */
export function deleteTag(name: string): void {
  for (const r of db.resources) {
    if (!r.tags.includes(name)) continue;
    r.tags = r.tags.filter((t) => t !== name);
  }
  db.resources = [...db.resources];
  commit();
}

/* ------------------------------------------------------------------ */
/* Dashboard statistics (real store counts, never hardcoded)            */
/* ------------------------------------------------------------------ */

export interface CmsStats {
  totalResources: number;
  publishedResources: number;
  draftResources: number;
  trashedResources: number;
  semesters: number;
  subjects: number;
  books: number;
  notices: number;
  featured: number;
}

export function getStats(): CmsStats {
  const live = db.resources.filter((r) => !r.deletedAt);
  return {
    totalResources: live.length,
    publishedResources: live.filter((r) => r.status === "published").length,
    draftResources: live.filter((r) => r.status === "draft").length,
    trashedResources: db.resources.filter((r) => r.deletedAt).length,
    semesters: db.semesters.filter((s) => !s.deletedAt).length,
    subjects: db.subjects.filter((s) => !s.deletedAt).length,
    books: db.books.filter((b) => !b.deletedAt).length,
    notices: db.notices.filter((n) => !n.deletedAt).length,
    featured: live.filter((r) => r.featured && r.status === "published").length,
  };
}

/* ------------------------------------------------------------------ */
/* Notice day-state computation                                        */
/* ------------------------------------------------------------------ */

/** Attach computed day state ("X Days Remaining"/"Today"/"Past") to a notice. */
export function noticeWithState(notice: Notice): NoticeWithState {
  const today = new Date();
  const date = new Date(notice.date);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfDay - startOfToday) / 86400000);
  const dayState: NoticeWithState["dayState"] = diffDays > 0 ? "upcoming" : diffDays === 0 ? "today" : "past";
  return {
    ...notice,
    dayCount: Math.abs(diffDays),
    dayState,
  };
}

/** Student dashboard notices: published, visible-on-dashboard, alive. */
export function getDashboardNotices(): NoticeWithState[] {
  return db.notices
    .filter((n) => !n.deletedAt && n.status === "published" && n.showOnDashboard)
    .map(noticeWithState)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.dayState !== b.dayState) return a.dayState === "today" ? -1 : a.dayState === "upcoming" ? -1 : 1;
      return +new Date(a.date) - +new Date(b.date);
    });
}

/** Student Notices page: every notice published by the admin (alive,
    any type, regardless of the dashboard-visibility flag). Same sort
    as the dashboard board — pinned first, then today/upcoming, past. */
export function getStudentNotices(): NoticeWithState[] {
  return db.notices
    .filter((n) => !n.deletedAt && n.status === "published")
    .map(noticeWithState)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.dayState !== b.dayState) return a.dayState === "today" ? -1 : a.dayState === "upcoming" ? -1 : 1;
      return +new Date(a.date) - +new Date(b.date);
    });
}

export { programInfo };
