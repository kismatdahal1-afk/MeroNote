import { describe, expect, it } from "vitest";
import { avatarSrc, initialsOf } from "../../components/common/UserAvatar";

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

describe("avatarSrc", () => {
  it("passes through trimmed HTTPS URLs", () => {
    expect(avatarSrc("https://pics.test/photo.png")).toBe("https://pics.test/photo.png");
    expect(avatarSrc("  https://pics.test/photo.png  ")).toBe("https://pics.test/photo.png");
  });

  it("rejects blank, non-HTTPS, and unsafe schemes", () => {
    expect(avatarSrc(undefined)).toBe("");
    expect(avatarSrc("")).toBe("");
    expect(avatarSrc("   ")).toBe("");
    expect(avatarSrc("http://pics.test/photo.png")).toBe("");
    expect(avatarSrc("data:image/png;base64,aaa")).toBe("");
    expect(avatarSrc("javascript:alert(1)")).toBe("");
    expect(avatarSrc("not a url")).toBe("");
  });
});
