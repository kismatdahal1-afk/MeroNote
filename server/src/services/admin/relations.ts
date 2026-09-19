import type { Types } from "mongoose";
import { Book, Resource, Semester, Subject, Topic } from "../../models";
import { parseObjectId } from "../../lib/api";
import { AdminError } from "./errors";

/**
 * Phase 11 relationship guards. Every parent reference is verified live
 * (exists + not soft-deleted); hierarchy consistency is enforced so a
 * resource can never point across semesters/subjects. Throws AdminError.
 */

export function reqId(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  const id = typeof value === "string" ? parseObjectId(value) : null;
  if (!id) throw new AdminError(400, `Field '${field}' must be a valid id.`);
  return id;
}

export function optId(body: Record<string, unknown>, field: string): string | undefined {
  if (body[field] === undefined) return undefined;
  return reqId(body, field);
}

async function liveById<T>(model: { findOne: (...args: never[]) => { exec(): Promise<T | null> } }, id: string, label: string): Promise<T> {
  const doc = await model.findOne({ _id: id, deletedAt: null } as never).exec();
  if (!doc) throw new AdminError(404, `${label} not found.`);
  return doc;
}

export async function requireLiveSemester(id: string): Promise<{ _id: Types.ObjectId }> {
  return liveById(Semester, id, "Semester");
}

export async function requireLiveSubject(id: string): Promise<{ _id: Types.ObjectId; semesterId: Types.ObjectId }> {
  return liveById(Subject, id, "Subject");
}

export async function requireLiveTopic(id: string): Promise<{ _id: Types.ObjectId; subjectId: Types.ObjectId }> {
  return liveById(Topic, id, "Topic");
}

export async function requireLiveBook(id: string): Promise<{ _id: Types.ObjectId }> {
  return liveById(Book, id, "Book");
}

/** Subject B must belong to semester A. */
export async function assertSubjectInSemester(subjectId: string, semesterId: string): Promise<void> {
  const subject = await requireLiveSubject(subjectId);
  if (String(subject.semesterId) !== semesterId) {
    throw new AdminError(400, "Subject does not belong to the given semester.");
  }
}

/** Topic T must belong to subject B. */
export async function assertTopicInSubject(topicId: string, subjectId: string): Promise<void> {
  const topic = await requireLiveTopic(topicId);
  if (String(topic.subjectId) !== subjectId) {
    throw new AdminError(400, "Topic does not belong to the given subject.");
  }
}

/** Child counts for safe-delete 409 responses (live children only). */
export async function childCounts(entity: "semester" | "subject" | "topic" | "book", id: string): Promise<Record<string, number>> {
  const alive = { deletedAt: null };
  switch (entity) {
    case "semester": {
      const [subjects, resources, books] = await Promise.all([
        Subject.countDocuments({ semesterId: id, ...alive }).exec(),
        Resource.countDocuments({ semesterId: id, ...alive }).exec(),
        Book.countDocuments({ semesterId: id, ...alive }).exec(),
      ]);
      return { subjects, resources, books };
    }
    case "subject": {
      const [topics, resources, books] = await Promise.all([
        Topic.countDocuments({ subjectId: id, ...alive }).exec(),
        Resource.countDocuments({ subjectId: id, ...alive }).exec(),
        Book.countDocuments({ subjectId: id, ...alive }).exec(),
      ]);
      return { topics, resources, books };
    }
    case "topic": {
      const resources = await Resource.countDocuments({ topicId: id, ...alive }).exec();
      return { resources };
    }
    case "book": {
      const resources = await Resource.countDocuments({ bookId: id, ...alive }).exec();
      return { resources };
    }
  }
}

export function describeChildren(counts: Record<string, number>): string {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => `${n} ${kind}`);
  return parts.join(", ");
}
