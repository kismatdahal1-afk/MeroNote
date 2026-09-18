import { User } from "../models";

/**
 * Role promotion helper (used by the dev-only promote-admin script).
 * Register always creates USER; promotion is explicit and auditable.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function promoteToAdmin(rawEmail: string): Promise<{ email: string; role: string }> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("Provide a valid email address to promote.");
  }
  const user = await User.findOneAndUpdate({ email }, { $set: { role: "ADMIN" } }, { returnDocument: "after" }).exec();
  if (!user) {
    throw new Error(`No user found with email ${email}. Register first, then promote.`);
  }
  return { email: user.email, role: user.role };
}
