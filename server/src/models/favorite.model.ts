import { Schema, model, type Document, type Types } from "mongoose";
import { FAVORITE_TARGETS } from "./enums";

export interface IFavorite extends Document {
  userId: Types.ObjectId;
  targetType: (typeof FAVORITE_TARGETS)[number];
  targetId: Types.ObjectId;
  createdAt: Date;
}

// Unified saves: one collection for resource + subject favorites
// (replaces frontend `favorites` + `favoriteSubjects` string arrays).

const favoriteSchema = new Schema<IFavorite>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, required: true, enum: FAVORITE_TARGETS },
    // Points at resources or subjects depending on targetType (validated app-side).
    targetId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Toggle idempotency + "is favorite?" check. No soft delete (hard remove on untoggle).
favoriteSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true, name: "user_target" });

export const Favorite = model<IFavorite>("Favorite", favoriteSchema, "favorites");
