import { describe, expect, test } from "bun:test";
import { validateFileName, validatePort, validateUsername } from "../shared/validate.ts";

describe("validation", () => {
  test("validates usernames", () => {
    expect(validateUsername("alice_1")).toBe("alice_1");
    expect(() => validateUsername("Alice")).toThrow();
    expect(() => validateUsername("a".repeat(40))).toThrow();
  });

  test("validates filenames", () => {
    expect(validateFileName("server.properties")).toBe("server.properties");
    expect(() => validateFileName("../x")).toThrow();
    expect(() => validateFileName("x\x00.jpg")).toThrow();
  });

  test("validates ports", () => {
    expect(validatePort("9090")).toBe(9090);
    expect(() => validatePort("70000")).toThrow();
  });
});
