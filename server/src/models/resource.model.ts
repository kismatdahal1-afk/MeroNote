import { Schema, model, type Document, type HydratedDocument, type Types } from "mongoose";
import { ALLOWED_MIME_TYPES, PUBLISH_STATUSES, RESOURCE_TYPES } from "./enums";

export interface IResourceFile {
  key: string;
  bucket: string;
  mime: (typeof ALLOWED_MIME_TYPES)[number];
  checksum?: string;
}

export interface IResource extends Document {
  semesterId: Types.ObjectId;
  subjectId: Types.ObjectId;
  topicId?: Types.ObjectId;
  title: string;
  description: string;
  type: (typeof RESOURCE_TYPES)[number];
  customType?: string;
  // Phase 11: file metadata is optional at rest so resources can be created
  // metadata-first and honestly fileless after file deletion. All validation
  // still applies whenever values are present. Fileless resources stay
  // unpublished until a file is attached (enforced API-side).
  fileName?: string;
  fileSize?: number;
  pageCount?: number;
  tags: string[];
  bookId?: Types.ObjectId;
  featured: boolean;
  paperYear?: number;
  paperFullMarks?: number;
  paperDurationMinutes?: number;
  status: (typeof PUBLISH_STATUSES)[number];
  hidden: boolean;
  file?: IResourceFile;
  uploadedBy?: Types.ObjectId;
  uploadedAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const resourceFileSchema = new Schema<IResourceFile>(
  {
    // Backblaze B2 object key, e.g. `resources/{resourceId}/{fileName}`.
    key: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (key: string) => key.length >= 1 && !key.split("/").includes(".."),
        message: "file.key must be non-empty and must not contain '..' segments.",
      },
    },
    bucket: { type: String, required: true, trim: true, minlength: 1 },
    mime: { type: String, required: true, enum: ALLOWED_MIME_TYPES },
    // Hex sha256 once the Phase 5 upload completes (optional until then).
    checksum: { type: String, required: false, match: /^[a-f0-9]{64}$/i },
  },
  { _id: false },
);

const resourceSchema = new Schema<IResource>(
  {
    // Denormalized copy of the subject's semester for single-filter queries.
    // MUST equal the parent subject's semester (enforced API-side, Phase 2+).
    semesterId: { type: Schema.Types.ObjectId, ref: "Semester", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    // Absent = subject-wide resource (e.g. whole-subject textbook).
    topicId: { type: Schema.Types.ObjectId, ref: "Topic", required: false },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    description: { type: String, required: false, default: "", maxlength: 5000 },
    type: { type: String, required: true, enum: RESOURCE_TYPES },
    customType: { type: String, required: false, trim: true, minlength: 1, maxlength: 60 },
    fileName: {
      type: String,
      required: false,
      trim: true,
      minlength: 1,
      maxlength: 255,
      validate: {
        validator: (name: string) => name.toLowerCase().endsWith(".pdf"),
        message: "fileName must end with .pdf (Phase 1 supports PDFs only).",
      },
    },
    fileSize: { type: Number, required: false, min: 1 },
    pageCount: { type: Number, required: false, min: 1 },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (tags: string[]) => tags.length <= 30,
        message: "tags holds at most 30 entries.",
      },
      // Normalized lowercase-trim (matches frontend tag handling).
      set: (tags: unknown) =>
        Array.isArray(tags)
          ? [...new Set(tags.filter((t) => typeof t === "string").map((t: string) => t.trim().toLowerCase()).filter(Boolean))]
          : tags,
    },
    // Single-direction link to books (Book.resourceId was removed by design).
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: false },
    featured: { type: Boolean, required: false, default: false },
    paperYear: { type: Number, required: false, min: 1900, max: 2100 },
    paperFullMarks: { type: Number, required: false, min: 1 },
    paperDurationMinutes: { type: Number, required: false, min: 1 },
    status: { type: String, required: true, enum: PUBLISH_STATUSES, default: "draft" },
    hidden: { type: Boolean, required: false, default: false },
    file: { type: resourceFileSchema, required: false },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
    deletedAt: { type: Date, required: false, default: undefined },
  },
  {
    // `uploadedAt` doubles as the creation timestamp (per architecture §4.5).
    timestamps: { createdAt: "uploadedAt", updatedAt: "updatedAt" },
  },
);

// `customType` is required iff type == "custom", forbidden otherwise.
resourceSchema.pre("validate", function (this: HydratedDocument<IResource>) {
  if (this.type === "custom" && !this.customType) {
    this.invalidate("customType", "customType is required when type is 'custom'.");
  }
  if (this.type !== "custom" && this.customType) {
    this.invalidate("customType", "customType is only allowed when type is 'custom'.");
  }
});

// Subject detail groups.
resourceSchema.index({ subjectId: 1, status: 1, hidden: 1 });
// Semester-wide + Resources page filters.
resourceSchema.index({ semesterId: 1, status: 1, hidden: 1 });
// Topic section fetch.
resourceSchema.index({ topicId: 1 }, { sparse: true });
// Tag filter + tag-usage aggregation.
resourceSchema.index({ tags: 1 });
// Admin queues + recent lists.
resourceSchema.index({ status: 1, hidden: 1, updatedAt: -1 });
// Metadata search (regex fallback in Phase 1; Atlas Search upgrade later).
resourceSchema.index({ title: "text", description: "text", tags: "text" });
resourceSchema.index({ deletedAt: 1 }, { partialFilterExpression: { deletedAt: { $exists: true } } });

export const Resource = model<IResource>("Resource", resourceSchema, "resources");
