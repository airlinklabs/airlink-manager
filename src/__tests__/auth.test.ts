import { describe, expect, test } from "bun:test";
import { fingerprint, issueWsToken, resolveUidGid, verifyWsToken } from "../daemon/auth.ts";

describe("auth helpers", () => {
  test("successful login primitives create expected TTL material", () => {
    const fp = fingerprint("127.0.0.1", "ua", "secret");
    expect(fp).toHaveLength(64);
  });

  test("WS token is valid for 15 minutes and expires", async () => {
    const token = await issueWsToken({ username: "alice", role: "user", sessionId: "s1", appSecret: "secret", now: 100 });
    await expect(verifyWsToken(token, "secret", 100 + 899)).resolves.toEqual({ username: "alice", role: "user", sessionId: "s1" });
    await expect(verifyWsToken(token, "secret", 100 + 901)).rejects.toThrow();
  });

  test("fingerprint mismatch is detectable", () => {
    expect(fingerprint("127.0.0.1", "ua", "secret")).not.toBe(fingerprint("127.0.0.2", "ua", "secret"));
  });

  test("resolves root uid as 0 or refuses root bridge", async () => {
    const result: { uid: number; gid: number } | Error = await resolveUidGid("root").catch((error: unknown) =>
      error instanceof Error ? error : new Error(String(error))
    );
    if (result instanceof Error) {
      expect(result.message).toContain("refusing root");
    } else {
      expect(result.uid).toBe(0);
    }
  });

  test("throws for non-existent user", async () => {
    await expect(resolveUidGid("nonexistent_user_airlink_test")).rejects.toThrow();
  });
});
