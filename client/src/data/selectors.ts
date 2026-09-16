import type { Book, Resource, Semester, Subject, Topic } from "../types";
import { getDb } from "../state/cmsStore";
import { programInfo } from "./mock";

/**
 * Lookup helpers over the CMS store (was: static mock data).
 *
 * IMPORTANT — these functions read the live CMS "database" imperatively.
 * Pages get reactivity through their CmsProvider-driven parents: any
 * component that calls useCms() (even a small one like a hidden sync
 * beacon) will re-render on every mutation, and these selectors called
 * during that render see fresh data. Each page subscribes via the
 * <CmsSync/> beacon so student pages update live with admin changes.
 *
 * When the real API arrives, this module is the single place to swap
 * local store reads for fetch calls without touching consumers.
 */

/** Entities visible to students: not deleted and published. */
function visible<T extends { deletedAt?: string; status: string; hidden?: boolean }>(list: T[]): T[] {
  return list.filter((x) => !x.deletedAt && x.status === "published" && !x.hidden);
}

export function getAllSemesters(): Semester[] {
  return visible(getDb().semesters).sort((a, b) => a.order - b.order);
}

export function getSemesterById(id: string | undefined): Semester | undefined {
  if (!id) return undefined;
  return getDb().semesters.find((s) => s.id === id && !s.deletedAt);
}

/** The semester the student is currently enrolled in. */
export function getActiveSemester(): Semester {
  const all = getDb().semesters;
  const enrolled = all.find((s) => s.id === programInfo.currentSemesterId);
  const byStatus = all.find((s) => s.enrollment === "active" && !s.deletedAt);
  const visibleSem = visible(all).sort((a, b) => a.order - b.order);
  return enrolled ?? byStatus ?? visibleSem[0] ?? all[0];
}

/** Count of core subjects across the curriculum. */
export function countCoreSubjects(): number {
  return visible(getDb().subjects).filter((s) => s.category === "core").length;
}

/** Resources tagged as exam-relevant (past papers, questions, important). */
export function getTrendingExamResources(): Resource[] {
  return visible(getDb().resources)
    .filter(
      (r) =>
        r.type === "past_paper" ||
        r.type === "important_questions" ||
        r.tags.some((t) => t.includes("exam") || t.includes("2080")),
    )
    .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
    .slice(0, 4);
}

export function getSubjectsBySemester(semesterId: string): Subject[] {
  return visible(getDb().subjects).filter((s) => s.semesterId === semesterId);
}

export function getSubjectById(id: string | undefined): Subject | undefined {
  if (!id) return undefined;
  return getDb().subjects.find((s) => s.id === id && !s.deletedAt);
}

/** Published topics for a subject, ordered by their admin-defined order. */
export function getTopicsBySubject(subjectId: string): Topic[] {
  return visible(getDb().topics)
    .filter((t) => t.subjectId === subjectId && t.published)
    .sort((a, b) => a.order - b.order);
}

export function getTopicById(id: string | undefined): Topic | undefined {
  if (!id) return undefined;
  return getDb().topics.find((t) => t.id === id && !t.deletedAt);
}

/** Resources linked to a specific topic. */
export function getResourcesByTopic(topicId: string): Resource[] {
  return visible(getDb().resources).filter((r) => r.topicId === topicId);
}

/** Subject-wide resources (not tied to any single topic), e.g. the textbook. */
export function getSubjectWideResources(subjectId: string): Resource[] {
  return visible(getDb().resources).filter((r) => r.subjectId === subjectId && !r.topicId);
}

export function getAllResources(): Resource[] {
  return visible(getDb().resources);
}

export function getResourceById(id: string | undefined): Resource | undefined {
  if (!id) return undefined;
  return getDb().resources.find((r) => r.id === id && !r.deletedAt);
}

export function getResourcesBySubject(subjectId: string): Resource[] {
  return visible(getDb().resources).filter((r) => r.subjectId === subjectId);
}

export function getResourcesBySemester(semesterId: string): Resource[] {
  return visible(getDb().resources).filter((r) => r.semesterId === semesterId);
}

export function countResourcesBySubject(subjectId: string): number {
  return getResourcesBySubject(subjectId).length;
}

export function countResourcesBySemester(semesterId: string): number {
  return getResourcesBySemester(semesterId).length;
}

/** Lightweight client-side search over resource metadata. */
export function searchResources(query: string): Resource[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return visible(getDb().resources).filter((r) => {
    const subject = getSubjectById(r.subjectId);
    const semester = getSemesterById(r.semesterId);
    return (
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      subject?.name.toLowerCase().includes(q) ||
      semester?.name.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      r.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}

/** All subjects visible to students (used by semester, favorites, bookmarks, downloads). */
export function getAllSubjects(): Subject[] {
  return visible(getDb().subjects);
}

/** All books visible to students. */
export function getAllBooks(): Book[] {
  return visible(getDb().books);
}
