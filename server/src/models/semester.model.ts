import { Schema, model, type Document } from "mongoose";
import { PUBLISH_STATUSES } from "./enums";

export interface ISemester extends Document {
  number: number;
  name: string;
  description: string;
  credits: number;
  order: number;
  status: (typeof PUBLISH_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const semesterSchema = new Schema<ISemester>(
  {
    number: { type: Number, required: true, unique: true, min: 1, max: 8 },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    description: { type: String, required: false, default: "", maxlength: 2000 },
    credits: { type: Number, required: false, default: 0, min: 0 },
    order: { type: Number, required: true, unique: true, min: 1 },
    status: { type: String, required: true, enum: PUBLISH_STATUSES, default: "draft" },
    deletedAt: { type: Date, required: false, default: undefined },
  },
  { timestamps: true },
);

// Cheap trash queries without polluting live indexes.
semesterSchema.index({ deletedAt: 1 }, { partialFilterExpression: { deletedAt: { $exists: true } } });

export const Semester = model<ISemester>("Semester", semesterSchema, "semesters");
