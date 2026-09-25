import { Schema, model, type Document, type Types } from "mongoose";

/** Bounded per-resource recent entry (Phase 19: only recentResources persisted). */
export interface IRecentEntry {
  resourceId: Types.ObjectId;
  openedAt: Date;
}

export interface IUserPreferences extends Document {
  userId: Types.ObjectId;
  /**
   * Bounded recent resources, most-recent-first, max 20. The ONLY
   * Phase 19 preference with proven product purpose (Dashboard Recently
   * Opened). Deliberately absent: selectedSemesterId (the Phase 16
   * semester plan owns the ongoing semester), readerPrefs toggles (gate no
   * behavior yet), theme (device-local by product decision), recent
   * subjects/notices (no consumers yet).
   */
  recentResources: IRecentEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const recentEntrySchema = new Schema<IRecentEntry>(
  {
    resourceId: { type: Schema.Types.ObjectId, ref: "Resource", required: true },
    openedAt: { type: Date, required: true },
  },
  { _id: false },
);

const userPreferencesSchema = new Schema<IUserPreferences>(
  {
    // Uniqueness enforced by the named index below (not inline, to avoid a
    // duplicate auto-index).
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recentResources: { type: [recentEntrySchema], required: true, default: [] },
  },
  { timestamps: true },
);

// One preferences document per user.
userPreferencesSchema.index({ userId: 1 }, { unique: true, name: "user_unique" });

export const RECENT_CAP = 20;

export const UserPreferences = model<IUserPreferences>(
  "UserPreferences",
  userPreferencesSchema,
  "user_preferences",
);
