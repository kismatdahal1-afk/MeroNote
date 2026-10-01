import { Schema, model, type Document, type Types } from "mongoose";
import { AUTH_PROVIDERS, USER_ROLES } from "./enums";

export interface ISemesterPref {
  semesterId: Types.ObjectId;
  startDate?: Date;
  endDate?: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  /** password = password-based account; google = Google-authenticated account. */
  authProvider: (typeof AUTH_PROVIDERS)[number];
  /** Absent for Google-only accounts (never fake, never an OAuth token). */
  passwordHash?: string;
  /** Google stable subject/sub. Absent for password accounts — never null. */
  googleId?: string;
  /** Google profile image URL when available. Absent when unknown. */
  profileImageUrl?: string;
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
    // Optional: Google-only accounts have no password (never fake it).
    passwordHash: { type: String, required: false, select: false },
    // Step 3: single-collection auth provider. Legacy documents without this
    // field are interpreted as the password-provider case — no migration.
    authProvider: { type: String, required: false, enum: AUTH_PROVIDERS, default: "password" },
    // Google stable subject/sub. Sparse unique: many password users coexist
    // without an ID while each Google identity stays unique. No null default.
    googleId: { type: String, required: false, unique: true, sparse: true },
    // External profile-image URL only (reference string; no binary stored).
    profileImageUrl: { type: String, required: false, trim: true, maxlength: 2048 },
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
