import type { Request, Response } from "express";
import { Semester, Subject } from "../models";
import { liveFilter } from "../repositories";
import { detailEnvelope, listEnvelope, parseObjectId, parsePagination } from "../lib/api";

export async function listSemesters(req: Request, res: Response): Promise<void> {
  const pagination = parsePagination(req.query);
  if ("error" in pagination) {
    res.status(400).json({ status: "error", message: pagination.error });
    return;
  }
  const { page, limit } = pagination;
  const filter = liveFilter();
  const [total, rows] = await Promise.all([
    Semester.countDocuments(filter).exec(),
    Semester.find(filter).sort({ order: 1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
  ]);
  res.json(listEnvelope(rows, page, limit, total));
}

export async function getSemester(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  if (!id) {
    res.status(400).json({ status: "error", message: "Invalid semester id." });
    return;
  }
  const semester = await Semester.findOne({ _id: id, ...liveFilter() }).lean().exec();
  if (!semester) {
    res.status(404).json({ status: "error", message: "Semester not found." });
    return;
  }
  const subjects = await Subject.find({ semesterId: id, ...liveFilter() }).sort({ name: 1 }).lean().exec();
  res.json(detailEnvelope({ ...semester, subjects }));
}
