import { describe, expect, test } from "bun:test";
import { decodeDaemonFrame, encodeFrame, makeBinaryFrame, parseBinaryFrame } from "../bridge/protocol.ts";
import type { DaemonFrame } from "../shared/types.ts";

describe("bridge protocol", () => {
  test("frame encode/decode roundtrip", () => {
    const frame: DaemonFrame = { id: crypto.randomUUID(), channel: "exec", action: "open", payload: { command: ["id"] } };
    expect(decodeDaemonFrame(encodeFrame(frame))).toEqual(frame);
  });

  test("binary frames route by first 36 bytes", () => {
    const channelId = crypto.randomUUID();
    const data = new TextEncoder().encode("hello");
    const parsed = parseBinaryFrame(makeBinaryFrame(channelId, data));
    expect(parsed.channelId).toBe(channelId);
    expect(new TextDecoder().decode(parsed.data)).toBe("hello");
  });
});
