import { Schema, model, type Document, type HydratedDocument, type Types } from "mongoose";
import { FAVORITE_TARGETS } from "./enums";

export interface IBookmark extends Document {
  userId: Types.ObjectId;
  targetType: (typeof FAVORITE_TARGETS)[number];
  targetId: Types.ObjectId;
  page?: number;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

const bookmarkSchema = new Schema<IBookmark>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, required: true, enum: FAVORITE_TARGETS },
    targetId: { type: Schema.Types.ObjectId, required: true },
    // Page marks are resource-only; subject bookmarks must not send `page`.
    page: {
      type: Number,
      required: function (this: IBookmark) {
        return this.targetType === "resource";
      },
      min: 1,
    },
    note: { type: String, required: false, default: "", maxlength: 1000 },
  },
  { timestamps: true },
);

bookmarkSchema.pre("validate", function (this: HydratedDocument<IBookmark>) {
  if (this.targetType === "subject" && this.page !== undefined) {
    this.invalidate("page", "page is only allowed for resource bookmarks.");
  }
});

// One mark per target (preserves the frontend "one bookmark per resource" guard).
bookmarkSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true, name: "user_target" });

export const Bookmark = model<IBookmark>("Bookmark", bookmarkSchema, "bookmarks");
