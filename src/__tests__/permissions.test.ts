import { describe, expect, test } from "bun:test";
import { assertRoleAtLeast } from "../shared/validate.ts";

describe("permissions", () => {
  test("role hierarchy blocks lower role", () => {
    expect(() => assertRoleAtLeast("user", "admin")).toThrow();
    expect(() => assertRoleAtLeast("admin", "user")).not.toThrow();
    expect(() => assertRoleAtLeast("owner", "admin")).not.toThrow();
  });

  test("banned cannot pass any active role", () => {
    expect(() => assertRoleAtLeast("banned", "user")).toThrow();
  });
});
