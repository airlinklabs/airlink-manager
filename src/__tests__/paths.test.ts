import { describe, expect, test } from "bun:test";
import path from "node:path";
import { validatePath } from "../shared/validate.ts";

const root = path.resolve(process.cwd(), ".tmp-test-root");

describe("validatePath", () => {
  test.each([
    "../../etc/passwd",
    "..%2F..%2Fetc%2Fpasswd",
    "/etc/passwd",
    "home/user/../../etc/shadow",
    "home/user/./../../etc/passwd",
    "file.txt\x00.jpg",
    "a".repeat(4097)
  ])("rejects traversal vector %s", (input) => {
    expect(() => validatePath(input, root)).toThrow();
  });

  test.each([".", "logs/app.log", "nested/file.txt"])("accepts valid path %s", (input) => {
    expect(validatePath(input, root).startsWith(root)).toBe(true);
  });
});
