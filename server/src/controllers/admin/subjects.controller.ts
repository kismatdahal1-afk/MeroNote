import type { Request, Response } from "express";
import { Subject } from "../../models";
import { PUBLISH_STATUSES, SUBJECT_CATEGORIES } from "../../models/enums";
import { detailEnvelope, listEnvelope, parseFlag, parseObjectId, parsePagination } from "../../lib/api";
import { restoreDoc, softDelete } from "../../repositories/content";
import { AdminError, sendAdminError } from "../../services/admin/errors";
import {
  bodyOf,
  optEnum,
  optNumber,
  optString,
  optStringArray,
  reqEnum,
  reqString,
} from "../../services/admin/fields";
import { childCounts, describeChildren, optId, reqId, requireLiveSemester } from "../../services/admin/relations";

export async function listSubjects(req: Request, res: Response): Promise<void> {
  try {
    const pagination = parsePagination(req.query);
    if ("error" in pagination) throw new AdminError(400, pagination.error);
    const query = req.query as Record<string, unknown>;
    const filter: Record<string, unknown> = {};
    if (query.semesterId !== undefined) filter.semesterId = optId(query, "semesterId");
    if (query.status !== undefined) filter.status = optEnum(query, "status", PUBLISH_STATUSES);
    if (!parseFlag(query.includeDeleted)) filter.deletedAt = null;
    const { page, limit } = pagination;
    const [total, rows] = await Promise.all([
      Subject.countDocuments(filter).exec(),
      Subject.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    ]);
    res.json(listEnvelope(rows, page, limit, total));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function getSubject(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid subject id.");
    const subject = await Subject.findById(id).lean().exec();
    if (!subject) throw new AdminError(404, "Subject not found.");
    res.json(detailEnvelope(subject));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function createSubject(req: Request, res: Response): Promise<void> {
  try {
    const body = bodyOf(req);
    const semesterId = reqId(body, "semesterId");
    await requireLiveSemester(semesterId);
    const created = await Subject.create({
      semesterId,
      name: reqString(body, "name", 1, 120),
      code: reqString(body, "code", 1, 20),
      description: optString(body, "description", 2000) ?? "",
      category: reqEnum(body, "category", SUBJECT_CATEGORIES),
      credits: optNumber(body, "credits", 0) ?? 0,
      fullMarks: optNumber(body, "fullMarks", 1),
      hotTopics: optStringArray(body, "hotTopics", 50, 120) ?? [],
      status: optEnum(body, "status", PUBLISH_STATUSES) ?? "draft",
    });
    res.status(201).json(detailEnvelope(created.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err, "Subject code already exists.")) throw err;
  }
}

export async function updateSubject(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid subject id.");
    const existing = await Subject.findById(id).exec();
    if (!existing) throw new AdminError(404, "Subject not found.");
    if (existing.deletedAt) throw new AdminError(400, "Subject is deleted. Restore it before editing.");
    const body = bodyOf(req);
    // semesterId is immutable: resources denormalize it, so moves would break
    // the invariant. Delete + recreate under the right semester instead.
    if (body.semesterId !== undefined) throw new AdminError(400, "Field 'semesterId' cannot be changed.");
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = reqString(body, "name", 1, 120);
    if (body.code !== undefined) update.code = reqString(body, "code", 1, 20);
    const description = optString(body, "description", 2000);
    if (description !== undefined) update.description = description;
    if (body.category !== undefined) update.category = reqEnum(body, "category", SUBJECT_CATEGORIES);
    const credits = optNumber(body, "credits", 0);
    if (credits !== undefined) update.credits = credits;
    // Nullable: null clears the optional total-marks override.
    const unset: Record<string, ""> = {};
    if (body.fullMarks !== undefined) {
      if (body.fullMarks === null) unset.fullMarks = "";
      else update.fullMarks = optNumber(body, "fullMarks", 1);
    }
    if (body.hotTopics !== undefined) update.hotTopics = optStringArray(body, "hotTopics", 50, 120) ?? [];
    const status = optEnum(body, "status", PUBLISH_STATUSES);
    if (status !== undefined) update.status = status;
    if (Object.keys(update).length === 0 && Object.keys(unset).length === 0) {
      throw new AdminError(400, "No valid fields to update.");
    }
    const updated = await Subject.findByIdAndUpdate(
      id,
      { $set: update, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
      { new: true, runValidators: true },
    ).exec();
    if (!updated) throw new AdminError(404, "Subject not found.");
    res.json(detailEnvelope(updated.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err, "Subject code already exists.")) throw err;
  }
}

export async function deleteSubject(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid subject id.");
    const existing = await Subject.findById(id).lean().exec();
    if (!existing) throw new AdminError(404, "Subject not found.");
    if (existing.deletedAt) {
      res.json(detailEnvelope({ id, deleted: true, alreadyDeleted: true }));
      return;
    }
    const counts = await childCounts("subject", id);
    const detail = describeChildren(counts);
    if (detail) {
      throw new AdminError(409, `Subject still has live content (${detail}). Delete it first.`);
    }
    await softDelete(Subject, id);
    res.json(detailEnvelope({ id, deleted: true }));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function restoreSubject(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid subject id.");
    const existing = await Subject.findById(id).lean().exec();
    if (!existing) throw new AdminError(404, "Subject not found.");
    if (!existing.deletedAt) throw new AdminError(400, "Subject is not deleted.");
    const restored = await restoreDoc(Subject, id);
    if (!restored) throw new AdminError(404, "Subject not found.");
    res.json(detailEnvelope(restored.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}
