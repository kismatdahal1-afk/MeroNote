import { Schema, model, type Document, type Types } from "mongoose";
import { PUBLISH_STATUSES, SUBJECT_CATEGORIES } from "./enums";

export interface ISubject extends Document {
  semesterId: Types.ObjectId;
  name: string;
  code: string;
  description: string;
  category: (typeof SUBJECT_CATEGORIES)[number];
  credits: number;
  hotTopics: string[];
  fullMarks?: number;
  status: (typeof PUBLISH_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// NOTE: `offlineSync` is intentionally NOT stored (derived per-user fraction).

const subjectSchema = new Schema<ISubject>(
  {
    semesterId: { type: Schema.Types.ObjectId, ref: "Semester", required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    // TU course codes are global (e.g. CSC101) → global unique.
    code: { type: String, required: true, unique: true, trim: true, minlength: 1, maxlength: 20 },
    description: { type: String, required: false, default: "", maxlength: 2000 },
    category: { type: String, required: true, enum: SUBJECT_CATEGORIES },
    credits: { type: Number, required: false, default: 0, min: 0 },
    hotTopics: {
      type: [String],
      default: [],
      validate: [
        {
          validator: (topics: string[]) => topics.length <= 50,
          message: "hotTopics holds at most 50 entries.",
        },
        {
          validator: (topics: string[]) =>
            topics.every((t) => typeof t === "string" && t.trim().length >= 1 && t.trim().length <= 120),
          message: "Each hot topic must be 1–120 characters.",
        },
      ],
    },
    fullMarks: { type: Number, required: false, min: 1 },
    status: { type: String, required: true, enum: PUBLISH_STATUSES, default: "draft" },
    deletedAt: { type: Date, required: false, default: undefined },
  },
  { timestamps: true },
);

// Semester library listing (most common query).
subjectSchema.index({ semesterId: 1, status: 1 });
subjectSchema.index({ deletedAt: 1 }, { partialFilterExpression: { deletedAt: { $exists: true } } });

export const Subject = model<ISubject>("Subject", subjectSchema, "subjects");
