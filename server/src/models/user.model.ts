import { Schema, model, type Document, type Types } from "mongoose";
import { USER_ROLES } from "./enums";

export interface ISemesterPref {
  semesterId: Types.ObjectId;
  startDate?: Date;
  endDate?: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: (typeof USER_ROLES)[number];
  semesterPrefs: ISemesterPref[];
  /** F1 session epoch: bumped atomically on logout; JWT.v must match it. */
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const semesterPrefSchema = new Schema<ISemesterPref>(
  {
    semesterId: { type: Schema.Types.ObjectId, ref: "Semester", required: true },
    startDate: { type: Date, required: false },
    endDate: { type: Date, required: false },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    // Never returned by default (Phase 4 auth will select it explicitly).
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: USER_ROLES, default: "USER" },
    semesterPrefs: {
      type: [semesterPrefSchema],
      default: [],
      validate: {
        validator: (prefs: ISemesterPref[]) => prefs.length <= 8,
        message: "semesterPrefs holds at most one entry per semester (max 8).",
      },
    },
    // F1 logout-invalidation epoch (default 0; no index needed).
    sessionVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const User = model<IUser>("User", userSchema, "users");
