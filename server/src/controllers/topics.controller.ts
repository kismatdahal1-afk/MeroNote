import type { Request, Response } from "express";
import { Resource, Topic } from "../models";
import { liveFilter, liveResourceFilter } from "../repositories";
import { detailEnvelope, listEnvelope, parseObjectId, parsePagination } from "../lib/api";

export async function listTopics(req: Request, res: Response): Promise<void> {
  const subjectId = parseObjectId(req.query.subjectId);
  if (!subjectId) {
    res.status(400).json({ status: "error", message: "Query 'subjectId' is required and must be a valid id." });
    return;
  }
  const pagination = parsePagination(req.query);
  if ("error" in pagination) {
    res.status(400).json({ status: "error", message: pagination.error });
    return;
  }
  const { page, limit } = pagination;
  const filter = { subjectId, ...liveFilter() };
  const [total, rows] = await Promise.all([
    Topic.countDocuments(filter).exec(),
    Topic.find(filter).sort({ order: 1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
  ]);
  res.json(listEnvelope(rows, page, limit, total));
}

export async function getTopic(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  if (!id) {
    res.status(400).json({ status: "error", message: "Invalid topic id." });
    return;
  }
  const topic = await Topic.findOne({ _id: id, ...liveFilter() }).lean().exec();
  if (!topic) {
    res.status(404).json({ status: "error", message: "Topic not found." });
    return;
  }
  const resources = await Resource.find({ topicId: id, ...liveResourceFilter() }).sort({ uploadedAt: -1 }).lean().exec();
  res.json(detailEnvelope({ ...topic, resources }));
}
