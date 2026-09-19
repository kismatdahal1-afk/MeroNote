import type { Request, Response } from "express";
import { Semester } from "../../models";
import { PUBLISH_STATUSES } from "../../models/enums";
import { detailEnvelope, listEnvelope, parseFlag, parseObjectId, parsePagination } from "../../lib/api";
import { restoreDoc } from "../../repositories/content";
import { AdminError, sendAdminError } from "../../services/admin/errors";
import { bodyOf, optEnum, optNumber, optString } from "../../services/admin/fields";

export async function listSemesters(req: Request, res: Response): Promise<void> {
  try {
    const pagination = parsePagination(req.query);
    if ("error" in pagination) throw new AdminError(400, pagination.error);
    const query = req.query as Record<string, unknown>;
    const filter: Record<string, unknown> = {};
    if (query.status !== undefined) filter.status = optEnum(query, "status", PUBLISH_STATUSES);
    if (!parseFlag(query.includeDeleted)) filter.deletedAt = null;
    const { page, limit } = pagination;
    const [total, rows] = await Promise.all([
      Semester.countDocuments(filter).exec(),
      Semester.find(filter).sort({ order: 1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    ]);
    res.json(listEnvelope(rows, page, limit, total));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function getSemester(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid semester id.");
    const semester = await Semester.findById(id).lean().exec();
    if (!semester) throw new AdminError(404, "Semester not found.");
    res.json(detailEnvelope(semester));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function createSemester(req: Request, res: Response): Promise<void> {
  try {
    // Fixed architecture: exactly 8 official semesters (1–8). No creation
    // via API — use the idempotent fixed-semester bootstrap instead.
    throw new AdminError(403, "Semesters are fixed (Semester 1–8) and cannot be created.");
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function updateSemester(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid semester id.");
    const existing = await Semester.findById(id).exec();
    if (!existing) throw new AdminError(404, "Semester not found.");
    if (existing.deletedAt) throw new AdminError(400, "Semester is deleted. Restore it before editing.");
    const body = bodyOf(req);
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) throw new AdminError(400, "Field 'name' must be a non-empty string.");
      if (body.name.trim().length > 80) throw new AdminError(400, "Field 'name' must be at most 80 characters.");
      update.name = body.name.trim();
    }
    const description = optString(body, "description", 2000);
    if (description !== undefined) update.description = description;
    const credits = optNumber(body, "credits", 0);
    if (credits !== undefined) update.credits = credits;
    const status = optEnum(body, "status", PUBLISH_STATUSES);
    if (status !== undefined) update.status = status;
    // `number` and `order` are immutable: semesters are fixed 1–8 in stable
    // order. Renumbering/reordering would break the stable identity that
    // subjects/resources reference.
    if (body.number !== undefined) throw new AdminError(400, "Field 'number' cannot be changed (semesters are fixed 1–8).");
    if (body.order !== undefined) throw new AdminError(400, "Field 'order' cannot be changed (semesters are fixed 1–8).");
    if (Object.keys(update).length === 0) throw new AdminError(400, "No valid fields to update.");
    const updated = await Semester.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).exec();
    if (!updated) throw new AdminError(404, "Semester not found.");
    res.json(detailEnvelope(updated.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err, "Semester order already exists.")) throw err;
  }
}

export async function deleteSemester(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid semester id.");
    const existing = await Semester.findById(id).lean().exec();
    if (!existing) throw new AdminError(404, "Semester not found.");
    // Fixed architecture: official semesters are never deleted (empty is valid).
    throw new AdminError(403, "Official semesters cannot be deleted (Semester 1–8 are fixed).");
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function restoreSemester(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid semester id.");
    const existing = await Semester.findById(id).lean().exec();
    if (!existing) throw new AdminError(404, "Semester not found.");
    if (!existing.deletedAt) throw new AdminError(400, "Semester is not deleted.");
    const restored = await restoreDoc(Semester, id);
    if (!restored) throw new AdminError(404, "Semester not found.");
    res.json(detailEnvelope(restored.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}
