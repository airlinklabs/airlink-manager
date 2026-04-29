import { describe, expect, test } from "bun:test";
import { createCsrfToken, validateCsrfToken } from "../daemon/csrf.ts";

describe("csrf", () => {
  test("generates and validates double submit token", async () => {
    const token = await createCsrfToken("session", "secret", 1000);
    await expect(validateCsrfToken("session", "secret", token, token, 1000)).resolves.toBeUndefined();
  });

  test("rejects mismatch", async () => {
    const token = await createCsrfToken("session", "secret", 1000);
    await expect(validateCsrfToken("session", "secret", token, "bad", 1000)).rejects.toThrow();
  });
});
