import { describe, expect, it } from "vitest";
import {
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_STRENGTH_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
  PASSWORD_WHITESPACE_MESSAGE,
  validateRegistrationPassword,
} from "../passwordRules";

/**
 * Manual-registration password rules (UI mirror of the backend validator).
 * The backend remains authoritative; these tests lock the client messages
 * and rule parity, including every example from the product requirements.
 */

describe("validateRegistrationPassword", () => {
  it("accepts a fully compliant password", () => {
    expect(validateRegistrationPassword("Kismat12@", "Kismat12@")).toBeNull();
    expect(validateRegistrationPassword("Correct-horse-8@", "Correct-horse-8@")).toBeNull();
    expect(validateRegistrationPassword("aB1!5678", "aB1!5678")).toBeNull();
  });

  it("rejects the documented invalid examples", () => {
    expect(validateRegistrationPassword("kismat12@", "kismat12@")).toBe(PASSWORD_STRENGTH_MESSAGE);
    expect(validateRegistrationPassword("KISMAT12@", "KISMAT12@")).toBe(PASSWORD_STRENGTH_MESSAGE);
    expect(validateRegistrationPassword("Kismatab@", "Kismatab@")).toBe(PASSWORD_STRENGTH_MESSAGE);
    expect(validateRegistrationPassword("Kismat123", "Kismat123")).toBe(PASSWORD_STRENGTH_MESSAGE);
    expect(validateRegistrationPassword("Kismat 12@", "Kismat 12@")).toBe(PASSWORD_WHITESPACE_MESSAGE);
  });

  it("rejects short and overlong passwords", () => {
    expect(validateRegistrationPassword("Kis1@ab", "Kis1@ab")).toBe(PASSWORD_TOO_SHORT_MESSAGE);
    expect(validateRegistrationPassword("", "")).toBe(PASSWORD_TOO_SHORT_MESSAGE);
    expect(validateRegistrationPassword(`Aa1!${"x".repeat(124)}`, `Aa1!${"x".repeat(124)}`)).toBeNull();
    expect(validateRegistrationPassword(`Aa1!${"x".repeat(125)}`, `Aa1!${"x".repeat(125)}`)).toBe(
      PASSWORD_TOO_SHORT_MESSAGE,
    );
  });

  it("rejects any whitespace anywhere", () => {
    expect(validateRegistrationPassword("Kismat 12@", "Kismat 12@")).toBe(PASSWORD_WHITESPACE_MESSAGE);
    expect(validateRegistrationPassword("Kismat\t12@", "Kismat\t12@")).toBe(PASSWORD_WHITESPACE_MESSAGE);
    expect(validateRegistrationPassword("Kismat\n12@", "Kismat\n12@")).toBe(PASSWORD_WHITESPACE_MESSAGE);
    expect(validateRegistrationPassword(" Kismat12@", " Kismat12@")).toBe(PASSWORD_WHITESPACE_MESSAGE);
  });

  it("rejects each missing character class", () => {
    expect(validateRegistrationPassword("kismat12@", "kismat12@")).toBe(PASSWORD_STRENGTH_MESSAGE);
    expect(validateRegistrationPassword("KISMAT12@", "KISMAT12@")).toBe(PASSWORD_STRENGTH_MESSAGE);
    expect(validateRegistrationPassword("Kismatab@", "Kismatab@")).toBe(PASSWORD_STRENGTH_MESSAGE);
    expect(validateRegistrationPassword("Kismat123", "Kismat123")).toBe(PASSWORD_STRENGTH_MESSAGE);
  });

  it("rejects mismatched confirmation after strength checks", () => {
    expect(validateRegistrationPassword("Kismat12@", "Kismat12!")).toBe(PASSWORD_MISMATCH_MESSAGE);
  });
});
