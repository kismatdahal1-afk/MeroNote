import type { Request, Response } from "express";
import { Book } from "../../models";
import { PUBLISH_STATUSES } from "../../models/enums";
import { detailEnvelope, listEnvelope, parseFlag, parseObjectId, parsePagination } from "../../lib/api";
import { restoreDoc, softDelete, unlinkBookResources } from "../../repositories/content";
import { AdminError, sendAdminError } from "../../services/admin/errors";
import { bodyOf, optEnum, optNumber, optString, reqInt, reqNumber, reqString } from "../../services/admin/fields";
import { assertSubjectInSemester, optId, reqId, requireLiveSemester, requireLiveSubject } from "../../services/admin/relations";

export async function listBooks(req: Request, res: Response): Promise<void> {
  try {
    const pagination = parsePagination(req.query);
    if ("error" in pagination) throw new AdminError(400, pagination.error);
    const query = req.query as Record<string, unknown>;
    const filter: Record<string, unknown> = {};
    if (query.semesterId !== undefined) filter.semesterId = optId(query, "semesterId");
    if (query.subjectId !== undefined) filter.subjectId = optId(query, "subjectId");
    if (query.status !== undefined) filter.status = optEnum(query, "status", PUBLISH_STATUSES);
    if (!parseFlag(query.includeDeleted)) filter.deletedAt = null;
    const { page, limit } = pagination;
    const [total, rows] = await Promise.all([
      Book.countDocuments(filter).exec(),
      Book.find(filter).sort({ title: 1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    ]);
    res.json(listEnvelope(rows, page, limit, total));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function getBook(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid book id.");
    const book = await Book.findById(id).lean().exec();
    if (!book) throw new AdminError(404, "Book not found.");
    res.json(detailEnvelope(book));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function createBook(req: Request, res: Response): Promise<void> {
  try {
    const body = bodyOf(req);
    const semesterId = reqId(body, "semesterId");
    const subjectId = reqId(body, "subjectId");
    await requireLiveSemester(semesterId);
    await requireLiveSubject(subjectId);
    await assertSubjectInSemester(subjectId, semesterId);
    const created = await Book.create({
      semesterId,
      subjectId,
      title: reqString(body, "title", 1, 200),
      author: optString(body, "author", 150) ?? "",
      description: optString(body, "description", 5000) ?? "",
      edition: optString(body, "edition", 60) ?? "",
      pageCount: reqInt(body, "pageCount", 1),
      fileSize: reqNumber(body, "fileSize", 1),
      status: optEnum(body, "status", PUBLISH_STATUSES) ?? "draft",
    });
    res.status(201).json(detailEnvelope(created.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function updateBook(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid book id.");
    const existing = await Book.findById(id).exec();
    if (!existing) throw new AdminError(404, "Book not found.");
    if (existing.deletedAt) throw new AdminError(400, "Book is deleted. Restore it before editing.");
    const body = bodyOf(req);
    const update: Record<string, unknown> = {};
    // Semester/subject moves are allowed (no denormalized children depend on
    // a book's parents); both ends are revalidated below.
    let semesterId = String(existing.semesterId);
    let subjectId = String(existing.subjectId);
    if (body.semesterId !== undefined) semesterId = reqId(body, "semesterId");
    if (body.subjectId !== undefined) subjectId = reqId(body, "subjectId");
    if (body.semesterId !== undefined || body.subjectId !== undefined) {
      await requireLiveSemester(semesterId);
      await requireLiveSubject(subjectId);
      await assertSubjectInSemester(subjectId, semesterId);
      update.semesterId = semesterId;
      update.subjectId = subjectId;
    }
    if (body.title !== undefined) update.title = reqString(body, "title", 1, 200);
    const author = optString(body, "author", 150);
    if (author !== undefined) update.author = author;
    const description = optString(body, "description", 5000);
    if (description !== undefined) update.description = description;
    const edition = optString(body, "edition", 60);
    if (edition !== undefined) update.edition = edition;
    if (body.pageCount !== undefined) update.pageCount = reqInt(body, "pageCount", 1);
    if (body.fileSize !== undefined) update.fileSize = reqNumber(body, "fileSize", 1);
    const status = optEnum(body, "status", PUBLISH_STATUSES);
    if (status !== undefined) update.status = status;
    if (Object.keys(update).length === 0) throw new AdminError(400, "No valid fields to update.");
    const updated = await Book.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).exec();
    if (!updated) throw new AdminError(404, "Book not found.");
    res.json(detailEnvelope(updated.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function deleteBook(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid book id.");
    const existing = await Book.findById(id).lean().exec();
    if (!existing) throw new AdminError(404, "Book not found.");
    if (existing.deletedAt) {
      res.json(detailEnvelope({ id, deleted: true, alreadyDeleted: true }));
      return;
    }
    // Single-direction link: resources keep existing, their bookId is cleared.
    const unlinked = await unlinkBookResources(id);
    await softDelete(Book, id);
    res.json(detailEnvelope({ id, deleted: true, unlinkedResources: unlinked }));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function restoreBook(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid book id.");
    const existing = await Book.findById(id).lean().exec();
    if (!existing) throw new AdminError(404, "Book not found.");
    if (!existing.deletedAt) throw new AdminError(400, "Book is not deleted.");
    const restored = await restoreDoc(Book, id);
    if (!restored) throw new AdminError(404, "Book not found.");
    res.json(detailEnvelope(restored.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}
