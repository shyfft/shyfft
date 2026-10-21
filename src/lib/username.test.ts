import { describe, expect, it } from "vitest";
import { validateUsername } from "./username";

describe("validateUsername", () => {
  it("rejects taken names case-insensitively", () => expect(validateUsername("Maya.Wild", ["maya.wild"])).toBe("That username is taken"));
  it("rejects short names", () => expect(validateUsername("ab", [])).not.toBeNull());
  it("rejects invalid chars", () => expect(validateUsername("hi!there", [])).not.toBeNull());
  it("accepts valid names", () => expect(validateUsername("new_user.1", [])).toBeNull());
});
