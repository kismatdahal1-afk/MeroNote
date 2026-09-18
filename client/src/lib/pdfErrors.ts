/**
 * Maps PDF.js / transport failures to friendly UI messages.
 * Pure module (no JSX) so the Node verification script can import it.
 * Never surfaces raw server, B2, or parser internals to users.
 */
export function describePdfError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);
  if (name === "PasswordException") return "This PDF is password-protected and can't be opened here.";
  if (name === "InvalidPDFException") return "This file couldn't be opened as a PDF.";
  if (name === "MissingPDFException") return "The PDF could not be found. Please try again later.";
  if (/fetch|network|load failed/i.test(message)) return "Couldn't download the PDF. Check your connection and retry.";
  return "Something went wrong while opening the PDF.";
}
