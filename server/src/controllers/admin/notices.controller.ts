import type { Request, Response } from "express";
import { Notice } from "../../models";
import { NOTICE_ANNOUNCERS, NOTICE_PRIORITIES, NOTICE_STATUSES, NOTICE_TYPES } from "../../models/enums";
import { detailEnvelope, listEnvelope, parseFlag, parseObjectId, parsePagination } from "../../lib/api";
import { restoreDoc, softDelete } from "../../repositories/content";
import { AdminError, sendAdminError } from "../../services/admin/errors";
import { bodyOf, optBoolean, optDate, optEnum, optString, reqDate, reqEnum, reqString } from "../../services/admin/fields";

export async function listNotices(req: Request, res: Response): Promise<void> {
  try {
    const pagination = parsePagination(req.query);
    if ("error" in pagination) throw new AdminError(400, pagination.error);
    const query = req.query as Record<string, unknown>;
    const filter: Record<string, unknown> = {};
    if (query.type !== undefined) filter.type = optEnum(query, "type", NOTICE_TYPES);
    if (query.priority !== undefined) filter.priority = optEnum(query, "priority", NOTICE_PRIORITIES);
    if (query.status !== undefined) filter.status = optEnum(query, "status", NOTICE_STATUSES);
    if (!parseFlag(query.includeDeleted)) filter.deletedAt = null;
    const { page, limit } = pagination;
    const [total, rows] = await Promise.all([
      Notice.countDocuments(filter).exec(),
      Notice.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    ]);
    res.json(listEnvelope(rows, page, limit, total));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function getNotice(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid notice id.");
    const notice = await Notice.findById(id).lean().exec();
    if (!notice) throw new AdminError(404, "Notice not found.");
    res.json(detailEnvelope(notice));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function createNotice(req: Request, res: Response): Promise<void> {
  try {
    const body = bodyOf(req);
    const created = await Notice.create({
      heading: reqString(body, "heading", 1, 150),
      subtext: optString(body, "subtext", 2000) ?? "",
      type: reqEnum(body, "type", NOTICE_TYPES),
      announcer: reqEnum(body, "announcer", NOTICE_ANNOUNCERS),
      date: reqDate(body, "date"),
      priority: optEnum(body, "priority", NOTICE_PRIORITIES) ?? "normal",
      status: optEnum(body, "status", NOTICE_STATUSES) ?? "draft",
      showOnDashboard: optBoolean(body, "showOnDashboard") ?? true,
      pinned: optBoolean(body, "pinned") ?? false,
    });
    res.status(201).json(detailEnvelope(created.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function updateNotice(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid notice id.");
    const existing = await Notice.findById(id).exec();
    if (!existing) throw new AdminError(404, "Notice not found.");
    if (existing.deletedAt) throw new AdminError(400, "Notice is deleted. Restore it before editing.");
    const body = bodyOf(req);
    const update: Record<string, unknown> = {};
    if (body.heading !== undefined) update.heading = reqString(body, "heading", 1, 150);
    const subtext = optString(body, "subtext", 2000);
    if (subtext !== undefined) update.subtext = subtext;
    if (body.type !== undefined) update.type = reqEnum(body, "type", NOTICE_TYPES);
    if (body.announcer !== undefined) update.announcer = reqEnum(body, "announcer", NOTICE_ANNOUNCERS);
    const date = optDate(body, "date");
    if (date !== undefined) update.date = date;
    const priority = optEnum(body, "priority", NOTICE_PRIORITIES);
    if (priority !== undefined) update.priority = priority;
    const status = optEnum(body, "status", NOTICE_STATUSES);
    if (status !== undefined) {
      update.status = status;
      // Mirror the model's publish hook (inactive on updates): first publish
      // stamps publishedAt, exactly once.
      if (status === "published" && !existing.publishedAt) update.publishedAt = new Date();
    }
    const showOnDashboard = optBoolean(body, "showOnDashboard");
    if (showOnDashboard !== undefined) update.showOnDashboard = showOnDashboard;
    const pinned = optBoolean(body, "pinned");
    if (pinned !== undefined) update.pinned = pinned;
    if (Object.keys(update).length === 0) throw new AdminError(400, "No valid fields to update.");
    const updated = await Notice.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).exec();
    if (!updated) throw new AdminError(404, "Notice not found.");
    res.json(detailEnvelope(updated.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function deleteNotice(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid notice id.");
    const existing = await Notice.findById(id).lean().exec();
    if (!existing) throw new AdminError(404, "Notice not found.");
    if (existing.deletedAt) {
      res.json(detailEnvelope({ id, deleted: true, alreadyDeleted: true }));
      return;
    }
    await softDelete(Notice, id);
    res.json(detailEnvelope({ id, deleted: true }));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function restoreNotice(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid notice id.");
    const existing = await Notice.findById(id).lean().exec();
    if (!existing) throw new AdminError(404, "Notice not found.");
    if (!existing.deletedAt) throw new AdminError(400, "Notice is not deleted.");
    const restored = await restoreDoc(Notice, id);
    if (!restored) throw new AdminError(404, "Notice not found.");
    res.json(detailEnvelope(restored.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}
