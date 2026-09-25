import { Schema, model, type Document, type HydratedDocument, type Types } from "mongoose";
import { SEMESTER_USER_STATUSES } from "./enums";

export interface IUserSemesterPlan extends Document {
  userId: Types.ObjectId;
  semesterId: Types.ObjectId;
  status: (typeof SEMESTER_USER_STATUSES)[number];
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// User-specific semester plan (Phase 16): the account-persisted mirror of
// the former device-only `meronote-semester-enrollment` state.
// The global `semesters` collection stays content-only — one row here
// represents one user's plan for one academic semester.
const userSemesterPlanSchema = new Schema<IUserSemesterPlan>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    semesterId: { type: Schema.Types.ObjectId, ref: "Semester", required: true },
    status: { type: String, required: true, enum: SEMESTER_USER_STATUSES },
    // Calendar term dates (yyyy-mm-dd from the UI, stored as UTC midnight).
    startDate: { type: Date, required: false },
    endDate: { type: Date, required: false },
  },
  { timestamps: true },
);

userSemesterPlanSchema.pre("validate", function (this: HydratedDocument<IUserSemesterPlan>) {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    this.invalidate("endDate", "Field 'endDate' must be after 'startDate'.");
  }
});

// At most one plan row per (user, semester).
userSemesterPlanSchema.index({ userId: 1, semesterId: 1 }, { unique: true, name: "user_semester" });
// Efficient per-user plan queries.
userSemesterPlanSchema.index({ userId: 1, status: 1 }, { name: "user_status" });
// Integrity net: maximum one ongoing semester per user (app-level demotion
// in the repository is the primary path; this index is the final guard).
userSemesterPlanSchema.index(
  { userId: 1 },
  { unique: true, name: "user_ongoing_unique", partialFilterExpression: { status: "ongoing" } },
);

export const UserSemesterPlan = model<IUserSemesterPlan>(
  "UserSemesterPlan",
  userSemesterPlanSchema,
  "user_semester_plans",
);
