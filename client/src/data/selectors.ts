import type { Resource, Semester, Subject } from "../types";
import { resources, semesters, subjects } from "./mock";

/**
 * Lookup helpers over mock data. When the API arrives (Phase 3+),
 * these can be swapped for API-backed implementations without
 * touching the consuming components.
 */

export function getAllSemesters(): Semester[] {
  return semesters;
}

export function getSemesterById(id: string | undefined): Semester | undefined {
  return semesters.find((s) => s.id === id);
}

export function getSubjectsBySemester(semesterId: string): Subject[] {
  return subjects.filter((s) => s.semesterId === semesterId);
}

export function getSubjectById(id: string | undefined): Subject | undefined {
  return subjects.find((s) => s.id === id);
}

export function getAllResources(): Resource[] {
  return resources;
}

export function getResourceById(id: string | undefined): Resource | undefined {
  return resources.find((r) => r.id === id);
}

export function getResourcesBySubject(subjectId: string): Resource[] {
  return resources.filter((r) => r.subjectId === subjectId);
}

export function getResourcesBySemester(semesterId: string): Resource[] {
  return resources.filter((r) => r.semesterId === semesterId);
}

export function countResourcesBySubject(subjectId: string): number {
  return getResourcesBySubject(subjectId).length;
}

export function countResourcesBySemester(semesterId: string): number {
  return getResourcesBySemester(semesterId).length;
}

/** Lightweight client-side search over mock metadata. */
export function searchResources(query: string): Resource[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return resources.filter((r) => {
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
