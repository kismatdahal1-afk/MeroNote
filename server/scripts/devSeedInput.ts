import type { DevSeedInput, DevSeedNotice } from "../src/seed/seedDev";
import {
  mockUser,
  resources,
  seedBookmarks,
  seedFavorites,
  seedProgress,
  semesters,
  subjects,
  topics,
} from "../../client/src/data/mock";

/**
 * Shared dev-seed input builder (used by seed-dev and verify-db).
 * Reads the UNMODIFIED frontend mock + the CMS starter notices and shapes
 * them into the DevSeedInput transform. No client files are modified.
 */

// Starter notices live in the frontend CMS store (state/cmsStore seedDb),
// replicated here as seed input (not imported — cmsStore is a browser store).
function starterNotices(): DevSeedNotice[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    {
      id: "notice-1",
      heading: "TU Board Exam — Sem IV",
      subtext: "Admit cards are available from the department office. Bring your student ID.",
      type: "exam",
      announcer: "examination",
      date: new Date(now + 1 * day).toISOString(),
      priority: "high",
      status: "published",
      showOnDashboard: true,
      pinned: true,
    },
    {
      id: "notice-2",
      heading: "DBMS Assignment 3 Deadline",
      subtext: "Submit normalization exercises via the department portal before 5 PM.",
      type: "deadline",
      announcer: "csit-department",
      date: new Date(now + 5 * day).toISOString(),
      priority: "normal",
      status: "published",
      showOnDashboard: true,
      pinned: false,
    },
    {
      id: "notice-3",
      heading: "Library Hours Extended",
      subtext: "Reading room stays open until 8 PM during the exam period.",
      type: "announcement",
      announcer: "library",
      date: new Date(now - 2 * day).toISOString(),
      priority: "low",
      status: "published",
      showOnDashboard: true,
      pinned: false,
    },
  ];
}

export function loadDevSeedInput(): DevSeedInput {
  return {
    semesters: semesters.map((s) => ({
      id: s.id,
      number: s.number,
      name: s.name,
      description: s.description,
      credits: s.credits,
    })),
    subjects: subjects.map((s) => ({
      id: s.id,
      semesterId: s.semesterId,
      name: s.name,
      code: s.code,
      description: s.description,
      category: s.category,
      credits: s.credits,
      hotTopics: s.hotTopics,
      fullMarks: s.fullMarks,
    })),
    topics: topics.map((t) => ({
      id: t.id,
      subjectId: t.subjectId,
      title: t.title,
      description: t.description,
      order: t.order,
      published: t.published,
    })),
    resources: resources.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      semesterId: r.semesterId,
      subjectId: r.subjectId,
      topicId: r.topicId,
      type: r.type,
      fileName: r.fileName,
      fileSize: r.fileSize,
      pageCount: r.pageCount,
      tags: r.tags,
    })),
    notices: starterNotices(),
    user: mockUser,
    favorites: seedFavorites,
    bookmarks: seedBookmarks.map((b) => ({ id: b.id, resourceId: b.resourceId, page: b.page, note: b.note })),
    progress: seedProgress.map((p) => ({ resourceId: p.resourceId, lastPage: p.lastPage })),
  };
}

export function mockCounts(): { semesters: number; subjects: number; topics: number; resources: number } {
  return {
    semesters: semesters.length,
    subjects: subjects.length,
    topics: topics.length,
    resources: resources.length,
  };
}
