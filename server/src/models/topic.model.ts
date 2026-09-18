import { Schema, model, type Document, type Types } from "mongoose";
import { PUBLISH_STATUSES } from "./enums";

export interface ITopic extends Document {
  subjectId: Types.ObjectId;
  title: string;
  description?: string;
  order: number;
  status: (typeof PUBLISH_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// NOTE: legacy `published: boolean` is intentionally NOT stored (redundant with status).

const topicSchema = new Schema<ITopic>(
  {
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 150 },
    description: { type: String, required: false, maxlength: 2000 },
    order: { type: Number, required: true, min: 1 },
    status: { type: String, required: true, enum: PUBLISH_STATUSES, default: "draft" },
    deletedAt: { type: Date, required: false, default: undefined },
  },
  { timestamps: true },
);

// Ordered syllabus fetch.
topicSchema.index({ subjectId: 1, order: 1 });
// Phase 10 unified search (single text index per collection).
topicSchema.index({ title: "text", description: "text" });
topicSchema.index({ deletedAt: 1 }, { partialFilterExpression: { deletedAt: { $exists: true } } });

export const Topic = model<ITopic>("Topic", topicSchema, "topics");
