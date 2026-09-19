import type { Request, Response } from "express";
import { Topic } from "../../models";
import { PUBLISH_STATUSES } from "../../models/enums";
import { detailEnvelope, listEnvelope, parseFlag, parseObjectId, parsePagination } from "../../lib/api";
import { restoreDoc, softDelete } from "../../repositories/content";
import { AdminError, sendAdminError } from "../../services/admin/errors";
import { bodyOf, optEnum, optInt, optString, reqInt, reqString } from "../../services/admin/fields";
import { childCounts, describeChildren, optId, reqId, requireLiveSubject } from "../../services/admin/relations";

async function maxOrder(subjectId: string): Promise<number> {
  const top = await Topic.findOne({ subjectId }).sort({ order: -1 }).select("order").lean().exec();
  return top ? top.order + 1 : 1;
}

export async function listTopics(req: Request, res: Response): Promise<void> {
  try {
    const pagination = parsePagination(req.query);
    if ("error" in pagination) throw new AdminError(400, pagination.error);
    const query = req.query as Record<string, unknown>;
    const filter: Record<string, unknown> = {};
    if (query.subjectId !== undefined) filter.subjectId = optId(query, "subjectId");
    if (query.status !== undefined) filter.status = optEnum(query, "status", PUBLISH_STATUSES);
    if (!parseFlag(query.includeDeleted)) filter.deletedAt = null;
    const { page, limit } = pagination;
    const [total, rows] = await Promise.all([
      Topic.countDocuments(filter).exec(),
      Topic.find(filter).sort({ order: 1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    ]);
    res.json(listEnvelope(rows, page, limit, total));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function getTopic(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid topic id.");
    const topic = await Topic.findById(id).lean().exec();
    if (!topic) throw new AdminError(404, "Topic not found.");
    res.json(detailEnvelope(topic));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function createTopic(req: Request, res: Response): Promise<void> {
  try {
    const body = bodyOf(req);
    const subjectId = reqId(body, "subjectId");
    await requireLiveSubject(subjectId);
    const created = await Topic.create({
      subjectId,
      title: reqString(body, "title", 1, 150),
      description: optString(body, "description", 2000),
      order: body.order === undefined ? await maxOrder(subjectId) : reqInt(body, "order", 1),
      status: optEnum(body, "status", PUBLISH_STATUSES) ?? "draft",
    });
    res.status(201).json(detailEnvelope(created.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function updateTopic(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid topic id.");
    const existing = await Topic.findById(id).exec();
    if (!existing) throw new AdminError(404, "Topic not found.");
    if (existing.deletedAt) throw new AdminError(400, "Topic is deleted. Restore it before editing.");
    const body = bodyOf(req);
    // subjectId is immutable (see subjects controller for rationale).
    if (body.subjectId !== undefined) throw new AdminError(400, "Field 'subjectId' cannot be changed.");
    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = reqString(body, "title", 1, 150);
    if (body.description !== undefined) update.description = optString(body, "description", 2000);
    if (body.order !== undefined) update.order = optInt(body, "order", 1);
    const status = optEnum(body, "status", PUBLISH_STATUSES);
    if (status !== undefined) update.status = status;
    if (Object.keys(update).length === 0) throw new AdminError(400, "No valid fields to update.");
    const updated = await Topic.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).exec();
    if (!updated) throw new AdminError(404, "Topic not found.");
    res.json(detailEnvelope(updated.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function deleteTopic(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid topic id.");
    const existing = await Topic.findById(id).lean().exec();
    if (!existing) throw new AdminError(404, "Topic not found.");
    if (existing.deletedAt) {
      res.json(detailEnvelope({ id, deleted: true, alreadyDeleted: true }));
      return;
    }
    const counts = await childCounts("topic", id);
    const detail = describeChildren(counts);
    if (detail) {
      throw new AdminError(409, `Topic still has live content (${detail}). Delete it first.`);
    }
    await softDelete(Topic, id);
    res.json(detailEnvelope({ id, deleted: true }));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function restoreTopic(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid topic id.");
    const existing = await Topic.findById(id).lean().exec();
    if (!existing) throw new AdminError(404, "Topic not found.");
    if (!existing.deletedAt) throw new AdminError(400, "Topic is not deleted.");
    const restored = await restoreDoc(Topic, id);
    if (!restored) throw new AdminError(404, "Topic not found.");
    res.json(detailEnvelope(restored.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}
