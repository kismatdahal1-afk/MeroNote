import type { Request, Response } from "express";
import { Semester } from "../../models";
import { PUBLISH_STATUSES } from "../../models/enums";
import { detailEnvelope, listEnvelope, parseFlag, parseObjectId, parsePagination } from "../../lib/api";
import { restoreDoc, softDelete } from "../../repositories/content";
import { AdminError, sendAdminError } from "../../services/admin/errors";
import { bodyOf, optEnum, optInt, optNumber, optString, reqString } from "../../services/admin/fields";
import { childCounts, describeChildren } from "../../services/admin/relations";

async function maxField(field: "number" | "order"): Promise<number> {
  const top = await Semester.findOne().sort({ [field]: -1 }).select(field).lean().exec();
  return top ? (top[field] as number) + 1 : 1;
}

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
    const body = bodyOf(req);
    const name = reqString(body, "name", 1, 80);
    const description = optString(body, "description", 2000) ?? "";
    const credits = optNumber(body, "credits", 0) ?? 0;
    const status = optEnum(body, "status", PUBLISH_STATUSES) ?? "draft";
    const number = optInt(body, "number", 1, 99) ?? (await maxField("number"));
    const order = optInt(body, "order", 1) ?? (await maxField("order"));
    const created = await Semester.create({ number, name, description, credits, order, status });
    res.status(201).json(detailEnvelope(created.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err, "Semester number or order already exists.")) throw err;
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
    if (body.order !== undefined) update.order = optInt(body, "order", 1);
    const status = optEnum(body, "status", PUBLISH_STATUSES);
    if (status !== undefined) update.status = status;
    // `number` is immutable: reordering uses `order`; renumbering would break
    // the stable Semester 1..8 identity.
    if (body.number !== undefined) throw new AdminError(400, "Field 'number' cannot be changed.");
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
    if (existing.deletedAt) {
      res.json(detailEnvelope({ id, deleted: true, alreadyDeleted: true }));
      return;
    }
    const counts = await childCounts("semester", id);
    const detail = describeChildren(counts);
    if (detail) {
      throw new AdminError(409, `Semester still has live content (${detail}). Delete it first.`);
    }
    await softDelete(Semester, id);
    res.json(detailEnvelope({ id, deleted: true }));
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
