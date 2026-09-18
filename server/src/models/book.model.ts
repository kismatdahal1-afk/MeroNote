import { Schema, model, type Document, type Types } from "mongoose";
import { PUBLISH_STATUSES } from "./enums";

export interface IBook extends Document {
  semesterId: Types.ObjectId;
  subjectId: Types.ObjectId;
  title: string;
  author: string;
  description: string;
  edition: string;
  pageCount: number;
  fileSize: number;
  status: (typeof PUBLISH_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// NOTE: `Book.resourceId` is intentionally NOT stored (single-direction
// Resource.bookId link only — resources pointing at a book are found via
// `resources { bookId }`).

const bookSchema = new Schema<IBook>(
  {
    semesterId: { type: Schema.Types.ObjectId, ref: "Semester", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    author: { type: String, required: false, default: "", maxlength: 150 },
    description: { type: String, required: false, default: "", maxlength: 5000 },
    edition: { type: String, required: false, default: "", maxlength: 60 },
    pageCount: { type: Number, required: true, min: 1 },
    fileSize: { type: Number, required: true, min: 1 },
    status: { type: String, required: true, enum: PUBLISH_STATUSES, default: "draft" },
    deletedAt: { type: Date, required: false, default: undefined },
  },
  { timestamps: true },
);

bookSchema.index({ subjectId: 1, status: 1 });
bookSchema.index({ semesterId: 1, status: 1 });
// Phase 10 unified search (single text index per collection).
bookSchema.index({ title: "text", author: "text", description: "text" });
bookSchema.index({ deletedAt: 1 }, { partialFilterExpression: { deletedAt: { $exists: true } } });

export const Book = model<IBook>("Book", bookSchema, "books");
