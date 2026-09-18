import { Schema, model, type Document, type HydratedDocument } from "mongoose";
import { NOTICE_ANNOUNCERS, NOTICE_PRIORITIES, NOTICE_STATUSES, NOTICE_TYPES } from "./enums";

export interface INotice extends Document {
  heading: string;
  subtext: string;
  type: (typeof NOTICE_TYPES)[number];
  announcer: (typeof NOTICE_ANNOUNCERS)[number];
  date: Date;
  priority: (typeof NOTICE_PRIORITIES)[number];
  status: (typeof NOTICE_STATUSES)[number];
  publishedAt?: Date;
  showOnDashboard: boolean;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// NOTE: `dayCount/dayState` stay computed client-side (noticeWithState) — never stored.

const noticeSchema = new Schema<INotice>(
  {
    heading: { type: String, required: true, trim: true, minlength: 1, maxlength: 150 },
    subtext: { type: String, required: false, default: "", maxlength: 2000 },
    type: { type: String, required: true, enum: NOTICE_TYPES },
    announcer: { type: String, required: true, enum: NOTICE_ANNOUNCERS },
    date: { type: Date, required: true },
    priority: { type: String, required: true, enum: NOTICE_PRIORITIES, default: "normal" },
    status: { type: String, required: true, enum: NOTICE_STATUSES, default: "draft" },
    // System-generated on first publish; never client-set.
    publishedAt: { type: Date, required: false },
    showOnDashboard: { type: Boolean, required: false, default: true },
    pinned: { type: Boolean, required: false, default: false },
    deletedAt: { type: Date, required: false, default: undefined },
  },
  { timestamps: true },
);

// Backfill the system-generated publish timestamp (mirrors cmsStore.updateNotice).
noticeSchema.pre("save", function (this: HydratedDocument<INotice>) {
  if (this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

noticeSchema.index({ status: 1, showOnDashboard: 1, pinned: 1, date: 1 });
// Phase 10 unified search (single text index per collection).
noticeSchema.index({ heading: "text", subtext: "text" });
noticeSchema.index({ deletedAt: 1 }, { partialFilterExpression: { deletedAt: { $exists: true } } });

export const Notice = model<INotice>("Notice", noticeSchema, "notices");
