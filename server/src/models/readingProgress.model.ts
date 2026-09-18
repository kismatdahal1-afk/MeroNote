import { Schema, model, type Document, type Types } from "mongoose";

export interface IReadingProgress extends Document {
  userId: Types.ObjectId;
  resourceId: Types.ObjectId;
  lastPage: number;
  progress: number;
  updatedAt: Date;
}

const readingProgressSchema = new Schema<IReadingProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    resourceId: { type: Schema.Types.ObjectId, ref: "Resource", required: true },
    lastPage: { type: Number, required: true, min: 1 },
    // 0..1 fraction. Phase 2 APIs recompute min(1, lastPage/pageCount)
    // and ignore client-sent values; range is enforced here.
    progress: { type: Number, required: true, min: 0, max: 1 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

// Upsert key (one row per user+resource) + Continue Reading sort.
readingProgressSchema.index({ userId: 1, resourceId: 1 }, { unique: true, name: "user_resource" });
readingProgressSchema.index({ userId: 1, updatedAt: -1 });

export const ReadingProgress = model<IReadingProgress>(
  "ReadingProgress",
  readingProgressSchema,
  "readingProgress",
);
