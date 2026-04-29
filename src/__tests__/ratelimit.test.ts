import { describe, expect, test } from "bun:test";
import { TokenBucketStore } from "../daemon/middleware.ts";

describe("token bucket", () => {
  test("5 auth attempts succeed and 6th is limited", () => {
    const store = new TokenBucketStore();
    const now = Date.now();
    for (let index = 0; index < 5; index += 1) {
      expect(store.consumeToken("ip:1", 5, 5 / 60, now).allowed).toBe(true);
    }
    const sixth = store.consumeToken("ip:1", 5, 5 / 60, now);
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfter).toBeGreaterThan(0);
  });

  test("refill period allows attempts again", () => {
    const store = new TokenBucketStore();
    const now = 1_000;
    for (let index = 0; index < 5; index += 1) {
      store.consumeToken("ip:1", 5, 5 / 60, now);
    }
    expect(store.consumeToken("ip:1", 5, 5 / 60, now + 60_000).allowed).toBe(true);
  });

  test("different IPs are independent", () => {
    const store = new TokenBucketStore();
    for (let index = 0; index < 5; index += 1) {
      store.consumeToken("ip:1", 5, 5 / 60, 1000);
    }
    expect(store.consumeToken("ip:2", 5, 5 / 60, 1000).allowed).toBe(true);
  });

  test("remaining and retryAfter are reported", () => {
    const store = new TokenBucketStore();
    const first = store.consumeToken("ip:1", 5, 5 / 60, 1000);
    expect(first.remaining).toBe(4);
    for (let index = 0; index < 4; index += 1) {
      store.consumeToken("ip:1", 5, 5 / 60, 1000);
    }
    expect(store.consumeToken("ip:1", 5, 5 / 60, 1000).retryAfter).toBeGreaterThan(0);
  });
});
