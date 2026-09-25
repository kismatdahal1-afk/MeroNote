import { Schema, model, type Document, type Types } from "mongoose";

export interface IDownloadHistory extends Document {
  userId: Types.ObjectId;
  resourceId: Types.ObjectId;
  /** Account-level state; "removed" reserved for the Phase 19 lifecycle. */
  status: "active";
  /** Byte count from the successful local write (blob.size), when known. */
  fileSize?: number;
  /** First/current download completion time (refreshed on re-download). */
  downloadedAt: Date;
  /** Last time completion was (re-)registered; verification updates are Phase 19. */
  lastVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Account-level download history (Phase 18): "this user downloaded this
// resource". Never holds PDF bytes — those stay device-local in IndexedDB.
// One row per (user, resource); re-download reactivates/refreshes the row.
const downloadHistorySchema = new Schema<IDownloadHistory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    resourceId: { type: Schema.Types.ObjectId, ref: "Resource", required: true },
    status: { type: String, required: true, enum: ["active"], default: "active" },
    fileSize: { type: Number, required: false, min: 1 },
    downloadedAt: { type: Date, required: true, default: Date.now },
    lastVerifiedAt: { type: Date, required: false },
  },
  { timestamps: true },
);

// One history record per (user, resource); recency-ordered user lists.
downloadHistorySchema.index({ userId: 1, resourceId: 1 }, { unique: true, name: "user_resource" });
downloadHistorySchema.index({ userId: 1, downloadedAt: -1 }, { name: "user_recency" });

export const DownloadHistory = model<IDownloadHistory>(
  "DownloadHistory",
  downloadHistorySchema,
  "download_history",
);
