import { describe, expect, test } from "bun:test";
import { createMemoryDatabaseAsync } from "../db/index.ts";

describe("database", () => {
  test("migration runs and prepared wrappers work", async () => {
    const { db, queries } = await createMemoryDatabaseAsync();
    queries.setConfig("app_name", "Test");
    expect(queries.getConfig("app_name")).toBe("Test");
    db.close();
  });

  test("audit log is immutable", async () => {
    const { db, queries } = await createMemoryDatabaseAsync();
    queries.audit("alice", "auth.login", {}, "127.0.0.1", "ok");
    expect(() => db.exec("UPDATE audit_log SET action = 'bad'")).toThrow();
    expect(() => db.exec("DELETE FROM audit_log")).toThrow();
    db.close();
  });
});
