import type { Request, Response } from "express";
import { Resource } from "../../models";
import { PUBLISH_STATUSES, RESOURCE_TYPES } from "../../models/enums";
import { detailEnvelope, listEnvelope, parseFlag, parseObjectId, parsePagination } from "../../lib/api";
import { restoreDoc, softDelete } from "../../repositories/content";
import { AdminError, sendAdminError } from "../../services/admin/errors";
import {
  bodyOf,
  optBoolean,
  optEnum,
  optInt,
  optNumber,
  optString,
  optStringArray,
  reqEnum,
  reqString,
} from "../../services/admin/fields";
import {
  assertSubjectInSemester,
  assertTopicInSubject,
  childCounts,
  describeChildren,
  optId,
  reqId,
  requireLiveBook,
  requireLiveSemester,
  requireLiveSubject,
} from "../../services/admin/relations";
import {
  FileRejectedError,
  StorageNotConfiguredError,
  deleteObject,
  uploadResourceFile,
} from "../../storage";

const PDF_PAGE_MAX = 10000;

function readPageCount(source: Record<string, unknown>): number | undefined {
  const raw = source.pageCount;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > PDF_PAGE_MAX) {
    throw new AdminError(400, `Field 'pageCount' must be an integer between 1 and ${PDF_PAGE_MAX}.`);
  }
  return value;
}

function rejectServerManagedFileFields(body: Record<string, unknown>): void {
  if (body.file !== undefined || body.fileSize !== undefined || body.checksum !== undefined) {
    throw new AdminError(
      400,
      "Fields 'file', 'fileSize' and 'checksum' are server-managed. Upload PDFs via POST /api/admin/resources/:id/file.",
    );
  }
}

async function assertResourceParents(input: { semesterId: string; subjectId: string; topicId?: string; bookId?: string }): Promise<void> {
  await requireLiveSemester(input.semesterId);
  await requireLiveSubject(input.subjectId);
  await assertSubjectInSemester(input.subjectId, input.semesterId);
  if (input.topicId !== undefined) {
    await assertTopicInSubject(input.topicId, input.subjectId);
  }
  if (input.bookId !== undefined) {
    await requireLiveBook(input.bookId);
  }
}

export async function listResources(req: Request, res: Response): Promise<void> {
  try {
    const pagination = parsePagination(req.query);
    if ("error" in pagination) throw new AdminError(400, pagination.error);
    const query = req.query as Record<string, unknown>;
    const filter: Record<string, unknown> = {};
    if (query.semesterId !== undefined) filter.semesterId = optId(query, "semesterId");
    if (query.subjectId !== undefined) filter.subjectId = optId(query, "subjectId");
    if (query.topicId !== undefined) filter.topicId = optId(query, "topicId");
    if (query.type !== undefined) {
      if (typeof query.type !== "string" || !(RESOURCE_TYPES as readonly string[]).includes(query.type)) {
        throw new AdminError(400, `Query 'type' must be one of: ${(RESOURCE_TYPES as readonly string[]).join(", ")}.`);
      }
      filter.type = query.type;
    }
    if (query.tag !== undefined) {
      if (typeof query.tag !== "string" || !query.tag.trim()) throw new AdminError(400, "Query 'tag' must be a non-empty string.");
      filter.tags = query.tag.trim().toLowerCase();
    }
    if (query.status !== undefined) filter.status = optEnum(query, "status", PUBLISH_STATUSES);
    if (query.hidden !== undefined) {
      if (query.hidden !== "true" && query.hidden !== "false") throw new AdminError(400, "Query 'hidden' must be 'true' or 'false'.");
      filter.hidden = query.hidden === "true";
    }
    if (!parseFlag(query.includeDeleted)) filter.deletedAt = null;
    const { page, limit } = pagination;
    const [total, rows] = await Promise.all([
      Resource.countDocuments(filter).exec(),
      Resource.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    ]);
    res.json(listEnvelope(rows, page, limit, total));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function getResource(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid resource id.");
    const resource = await Resource.findById(id).lean().exec();
    if (!resource) throw new AdminError(404, "Resource not found.");
    res.json(detailEnvelope(resource));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function createResource(req: Request, res: Response): Promise<void> {
  try {
    const body = bodyOf(req);
    rejectServerManagedFileFields(body);
    const semesterId = reqId(body, "semesterId");
    const subjectId = reqId(body, "subjectId");
    const topicId = optId(body, "topicId");
    const bookId = optId(body, "bookId");
    await assertResourceParents({ semesterId, subjectId, topicId, bookId });
    const type = reqEnum(body, "type", RESOURCE_TYPES);
    if (type !== "custom" && body.customType !== undefined) {
      throw new AdminError(400, "Field 'customType' is only allowed when type is 'custom'.");
    }
    const created = await Resource.create({
      semesterId,
      subjectId,
      topicId,
      bookId,
      title: reqString(body, "title", 1, 200),
      description: optString(body, "description", 5000) ?? "",
      type,
      customType: type === "custom" ? reqString(body, "customType", 1, 60) : undefined,
      fileName: body.fileName === undefined ? undefined : reqString(body, "fileName", 1, 255),
      pageCount: readPageCount(body),
      tags: optStringArray(body, "tags", 30, 40, true) ?? [],
      featured: optBoolean(body, "featured") ?? false,
      hidden: optBoolean(body, "hidden") ?? false,
      paperYear: optInt(body, "paperYear", 1900, 2100),
      paperFullMarks: optNumber(body, "paperFullMarks", 1),
      paperDurationMinutes: optNumber(body, "paperDurationMinutes", 1),
      status: optEnum(body, "status", PUBLISH_STATUSES) ?? "draft",
      uploadedBy: req.user!.id,
    });
    res.status(201).json(detailEnvelope(created.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function updateResource(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid resource id.");
    const existing = await Resource.findById(id).exec();
    if (!existing) throw new AdminError(404, "Resource not found.");
    if (existing.deletedAt) throw new AdminError(400, "Resource is deleted. Restore it before editing.");
    const body = bodyOf(req);
    rejectServerManagedFileFields(body);
    const update: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};
    // Parent moves are allowed but fully revalidated to preserve hierarchy.
    let semesterId = String(existing.semesterId);
    let subjectId = String(existing.subjectId);
    if (body.semesterId !== undefined) semesterId = reqId(body, "semesterId");
    if (body.subjectId !== undefined) subjectId = reqId(body, "subjectId");
    let topicId = existing.topicId ? String(existing.topicId) : undefined;
    if (body.topicId !== undefined) {
      topicId = body.topicId === null ? undefined : optId(body, "topicId");
    }
    let bookId = existing.bookId ? String(existing.bookId) : undefined;
    if (body.bookId !== undefined) {
      bookId = body.bookId === null ? undefined : optId(body, "bookId");
    }
    if (body.semesterId !== undefined || body.subjectId !== undefined || body.topicId !== undefined || body.bookId !== undefined) {
      await assertResourceParents({ semesterId, subjectId, topicId, bookId });
      update.semesterId = semesterId;
      update.subjectId = subjectId;
      // Cleared relations use $unset (Mongoose ignores undefined in $set).
      if (topicId === undefined) unset.topicId = "";
      else update.topicId = topicId;
      if (bookId === undefined) unset.bookId = "";
      else update.bookId = bookId;
    }
    if (body.title !== undefined) update.title = reqString(body, "title", 1, 200);
    const description = optString(body, "description", 5000);
    if (description !== undefined) update.description = description;
    const effectiveType = body.type !== undefined ? reqEnum(body, "type", RESOURCE_TYPES) : existing.type;
    if (body.type !== undefined) update.type = effectiveType;
    // Mirror the model hook (inactive on updates): customType iff custom.
    if (body.customType !== undefined || body.type !== undefined) {
      if (effectiveType === "custom") {
        update.customType = body.customType !== undefined ? reqString(body, "customType", 1, 60) : existing.customType;
        if (!update.customType) throw new AdminError(400, "Field 'customType' is required when type is 'custom'.");
      } else if (body.customType !== undefined) {
        throw new AdminError(400, "Field 'customType' is only allowed when type is 'custom'.");
      } else {
        unset.customType = "";
      }
    }
    if (body.fileName !== undefined) update.fileName = reqString(body, "fileName", 1, 255);
    if (body.pageCount !== undefined) update.pageCount = readPageCount(body);
    if (body.tags !== undefined) update.tags = optStringArray(body, "tags", 30, 40, true) ?? [];
    const featured = optBoolean(body, "featured");
    if (featured !== undefined) update.featured = featured;
    const hidden = optBoolean(body, "hidden");
    if (hidden !== undefined) update.hidden = hidden;
    if (body.paperYear !== undefined) {
      if (body.paperYear === null) unset.paperYear = "";
      else update.paperYear = optInt(body, "paperYear", 1900, 2100);
    }
    if (body.paperFullMarks !== undefined) {
      if (body.paperFullMarks === null) unset.paperFullMarks = "";
      else update.paperFullMarks = optNumber(body, "paperFullMarks", 1);
    }
    if (body.paperDurationMinutes !== undefined) {
      if (body.paperDurationMinutes === null) unset.paperDurationMinutes = "";
      else update.paperDurationMinutes = optNumber(body, "paperDurationMinutes", 1);
    }
    const status = optEnum(body, "status", PUBLISH_STATUSES);
    if (status !== undefined) update.status = status;
    if (Object.keys(update).length === 0 && Object.keys(unset).length === 0) {
      throw new AdminError(400, "No valid fields to update.");
    }
    const updated = await Resource.findByIdAndUpdate(
      id,
      { $set: update, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
      { new: true, runValidators: true },
    ).exec();
    if (!updated) throw new AdminError(404, "Resource not found.");
    res.json(detailEnvelope(updated.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function deleteResource(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid resource id.");
    const existing = await Resource.findById(id).lean().exec();
    if (!existing) throw new AdminError(404, "Resource not found.");
    if (existing.deletedAt) {
      res.json(detailEnvelope({ id, deleted: true, alreadyDeleted: true }));
      return;
    }
    await softDelete(Resource, id);
    res.json(detailEnvelope({ id, deleted: true }));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function restoreResource(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid resource id.");
    const existing = await Resource.findById(id).lean().exec();
    if (!existing) throw new AdminError(404, "Resource not found.");
    if (!existing.deletedAt) throw new AdminError(400, "Resource is not deleted.");
    const restored = await restoreDoc(Resource, id);
    if (!restored) throw new AdminError(404, "Resource not found.");
    res.json(detailEnvelope(restored.toObject()));
  } catch (err) {
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function uploadResourcePdf(req: Request, res: Response): Promise<void> {
  // NOTE: multer (uploadSinglePdf) runs as route middleware before this
  // handler. Never invoke it from inside here: it answers MulterErrors
  // itself without calling next(), which would hang this handler.
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid resource id.");
    const file = req.file;
    if (!file) {
      throw new AdminError(400, "Expected a single PDF file field named 'file'.");
    }
    // Existence (and liveness) is checked before touching storage so a
    // missing resource is 404 even when B2 is unconfigured.
    const target = await Resource.findById(id).select("deletedAt").lean().exec();
    if (!target) throw new AdminError(404, "Resource not found.");
    if (target.deletedAt) throw new AdminError(400, "Resource is deleted. Restore it before uploading.");
    // Multipart fields arrive as strings; pageCount stays admin-supplied.
    const pageCount = readPageCount({ pageCount: (req.body as Record<string, unknown> | undefined)?.pageCount });
    const fileName = file.originalname.trim();
    const oldKey = await uploadResourceFile({
      resourceId: id,
      fileName,
      mime: file.mimetype,
      body: file.buffer,
      persist: async (meta) => {
        const before = await Resource.findById(id).select("file").lean().exec();
        if (!before) throw new AdminError(404, "Resource not found.");
        if (before.deletedAt) throw new AdminError(400, "Resource is deleted. Restore it before uploading.");
        await Resource.findByIdAndUpdate(
          id,
          {
            $set: {
              file: { key: meta.key, bucket: meta.bucket, mime: meta.mime, checksum: meta.checksum },
              fileName,
              fileSize: meta.sizeBytes,
              ...(pageCount !== undefined ? { pageCount } : {}),
            },
          },
          { runValidators: true },
        ).exec();
        return before.file?.key;
      },
    });
    // Replacement rule: the old object goes only after the new metadata won.
    if (oldKey) {
      await deleteObject(oldKey).catch(() => {});
    }
    const updated = await Resource.findById(id).lean().exec();
    res.json(detailEnvelope({ fileName: updated?.fileName, fileSize: updated?.fileSize, mime: updated?.file?.mime, checksum: updated?.file?.checksum, pageCount: updated?.pageCount }));
  } catch (err) {
    if (err instanceof FileRejectedError || (err as { name?: string })?.name === "StorageNotConfiguredError") {
      res.status(err instanceof FileRejectedError ? 400 : 503).json({
        status: "error",
        message:
          err instanceof FileRejectedError
            ? err.message
            : "File storage is not configured. Set B2 credentials to enable uploads.",
      });
      return;
    }
    if (!sendAdminError(res, err)) throw err;
  }
}

export async function deleteResourcePdf(req: Request, res: Response): Promise<void> {
  try {
    const id = parseObjectId(req.params.id);
    if (!id) throw new AdminError(400, "Invalid resource id.");
    const existing = await Resource.findById(id).lean().exec();
    if (!existing || existing.deletedAt) throw new AdminError(404, "Resource not found.");
    const key = existing.file?.key;
    if (!key) throw new AdminError(410, "Resource has no file attached.");
    await deleteObject(key);
    // A fileless resource must never appear public: clear file metadata and
    // force draft in one update.
    await Resource.findByIdAndUpdate(
      id,
      { $unset: { file: "", fileName: "", fileSize: "", pageCount: "" }, $set: { status: "draft" } },
    ).exec();
    res.json(detailEnvelope({ id, removed: true }));
  } catch (err) {
    if (err instanceof StorageNotConfiguredError || (err as { name?: string })?.name === "StorageMissingError") {
      res.status(503).json({ status: "error", message: "File storage is temporarily unavailable. Please try again later." });
      return;
    }
    if (!sendAdminError(res, err)) throw err;
  }
}
