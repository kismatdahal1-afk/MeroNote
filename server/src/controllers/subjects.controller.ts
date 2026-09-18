import type { Request, Response } from "express";
import { Resource, Subject, Topic } from "../models";
import { liveFilter, liveResourceFilter } from "../repositories";
import { detailEnvelope, listEnvelope, parseObjectId, parsePagination } from "../lib/api";

export async function listSubjects(req: Request, res: Response): Promise<void> {
  const semesterId = parseObjectId(req.query.semesterId);
  if (!semesterId) {
    res.status(400).json({ status: "error", message: "Query 'semesterId' is required and must be a valid id." });
    return;
  }
  const pagination = parsePagination(req.query);
  if ("error" in pagination) {
    res.status(400).json({ status: "error", message: pagination.error });
    return;
  }
  const { page, limit } = pagination;
  const filter = { semesterId, ...liveFilter() };
  const [total, rows] = await Promise.all([
    Subject.countDocuments(filter).exec(),
    Subject.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
  ]);
  res.json(listEnvelope(rows, page, limit, total));
}

export async function getSubject(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  if (!id) {
    res.status(400).json({ status: "error", message: "Invalid subject id." });
    return;
  }
  const subject = await Subject.findOne({ _id: id, ...liveFilter() }).lean().exec();
  if (!subject) {
    res.status(404).json({ status: "error", message: "Subject not found." });
    return;
  }
  const [topics, resources] = await Promise.all([
    Topic.find({ subjectId: id, ...liveFilter() }).sort({ order: 1 }).lean().exec(),
    Resource.find({ subjectId: id, ...liveResourceFilter() }).sort({ uploadedAt: -1 }).lean().exec(),
  ]);
  res.json(detailEnvelope({ ...subject, topics, resources }));
}
