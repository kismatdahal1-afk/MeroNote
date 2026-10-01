import { describe, expect, it } from "vitest";
import { initialsOf } from "../../components/common/UserAvatar";

describe("initialsOf", () => {
  it("takes the first letters of the first two words", () => {
    expect(initialsOf("Aarav Sharma")).toBe("AS");
  });

  it("handles a single name", () => {
    expect(initialsOf("Aarav")).toBe("A");
  });

  it("caps at two words", () => {
    expect(initialsOf("Aarav Bahadur Sharma")).toBe("AB");
  });

  it("returns empty for an empty name", () => {
    expect(initialsOf("")).toBe("");
  });
});
