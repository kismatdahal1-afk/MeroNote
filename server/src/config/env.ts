import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  // MongoDB Atlas connection string. Never hardcoded, never committed.
  // Undefined until the deploy environment provides it (see .env.example).
  mongodbUri: process.env.MONGODB_URI || "",
  // HMAC secret for session JWTs. Required in every environment that serves
  // auth traffic — the server refuses to sign/verify without it.
  jwtSecret: process.env.JWT_SECRET || "",
  // F4: long-lived login duration belongs to the rotating refresh token.
  // This knob is the default refresh lifetime (days) for logins without
  // "Remember me" (remembered logins use 30 days). The access JWT itself is
  // always short-lived (see accessTokenMinutes in auth/tokens.ts).
  jwtExpiresDays: Number(process.env.JWT_EXPIRES_DAYS) || 7,
  // Backblaze B2 object storage (S3-compatible). Credentials are
  // environment-only and validated lazily by the storage layer, so MongoDB
  // boot never depends on B2 being configured (see .env.example).
  b2Region: process.env.B2_REGION || "us-east-005",
  b2Endpoint: process.env.B2_ENDPOINT || "",
  b2KeyId: process.env.B2_KEY_ID || "",
  b2ApplicationKey: process.env.B2_APPLICATION_KEY || "",
  b2BucketName: process.env.B2_BUCKET_NAME || "",
  // Maximum accepted PDF size in bytes (default 100 MB).
  maxPdfBytes: Number(process.env.MAX_PDF_BYTES) || 100 * 1024 * 1024,
};
