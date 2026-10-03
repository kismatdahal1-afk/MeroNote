/**
 * Manual-registration password rules (UI-only mirror of the backend
 * `validateRegistrationFields` password checks). Returns the user-facing
 * error message, or null when the password is acceptable. The backend
 * remains authoritative; this only fails fast with the same messages.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

const PASSWORD_STRENGTH_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/;
const WHITESPACE_PATTERN = /\s/;

export const PASSWORD_TOO_SHORT_MESSAGE = "Password must be at least 8 characters.";
export const PASSWORD_WHITESPACE_MESSAGE = "Password must not contain spaces.";
export const PASSWORD_STRENGTH_MESSAGE =
  "Password must include an uppercase letter, a lowercase letter, a number, and a special character.";
export const PASSWORD_MISMATCH_MESSAGE = "Passwords do not match.";

/**
 * Validate a registration password pair. `password` should already be
 * trimmed the way it will be submitted (leading/trailing whitespace never
 * persists server-side either).
 */
export function validateRegistrationPassword(password: string, confirmPassword: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return PASSWORD_TOO_SHORT_MESSAGE;
  }
  if (WHITESPACE_PATTERN.test(password)) {
    return PASSWORD_WHITESPACE_MESSAGE;
  }
  if (!PASSWORD_STRENGTH_PATTERN.test(password)) {
    return PASSWORD_STRENGTH_MESSAGE;
  }
  if (password !== confirmPassword) {
    return PASSWORD_MISMATCH_MESSAGE;
  }
  return null;
}
