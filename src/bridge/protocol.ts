import { BridgeFrame, CHANNEL_TYPES, FRAME_ACTIONS, type DaemonFrame } from "../shared/types.ts";
import { ValidationError } from "../shared/errors.ts";

const decoder = new TextDecoder();

export function encodeFrame(frame: DaemonFrame | BridgeFrame): string {
  return `${JSON.stringify(frame)}\n`;
}

export function decodeDaemonFrame(line: string): DaemonFrame {
  const parsed = JSON.parse(line) as unknown;
  if (!isDaemonFrame(parsed)) {
    throw new ValidationError("Invalid daemon frame");
  }
  return parsed;
}

export function decodeBridgeFrame(line: string): BridgeFrame {
  const parsed = JSON.parse(line) as unknown;
  if (!isBridgeFrame(parsed)) {
    throw new ValidationError("Invalid bridge frame");
  }
  return parsed;
}

export async function readDaemonFrames(
  stream: ReadableStream<Uint8Array>,
  onFrame: (frame: DaemonFrame) => void | Promise<void>
): Promise<void> {
  await readLines(stream, async (line) => {
    if (line.trim().length > 0) {
      await onFrame(decodeDaemonFrame(line));
    }
  });
}

export async function readFrameLines(
  stream: ReadableStream<Uint8Array>,
  onFrame: (frame: BridgeFrame) => void | Promise<void>
): Promise<void> {
  await readLines(stream, async (line) => {
    if (line.trim().length > 0) {
      await onFrame(decodeBridgeFrame(line));
    }
  });
}

export function parseBinaryFrame(frame: Uint8Array): { channelId: string; data: Uint8Array } {
  if (frame.byteLength < 36) {
    throw new ValidationError("Binary frame missing channel id");
  }
  const channelId = decoder.decode(frame.slice(0, 36));
  const data = frame.slice(36);
  return { channelId, data };
}

export function makeBinaryFrame(channelId: string, data: Uint8Array): Uint8Array {
  if (channelId.length !== 36) {
    throw new ValidationError("channelId must be a UUID string");
  }
  const idBytes = new TextEncoder().encode(channelId);
  const out = new Uint8Array(36 + data.byteLength);
  out.set(idBytes, 0);
  out.set(data, 36);
  return out;
}

async function readLines(
  stream: ReadableStream<Uint8Array>,
  onLine: (line: string) => void | Promise<void>
): Promise<void> {
  const reader = stream.getReader();
  let buffered = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffered.length > 0) {
        await onLine(buffered);
      }
      return;
    }
    buffered += decoder.decode(value, { stream: true });
    for (;;) {
      const newline = buffered.indexOf("\n");
      if (newline === -1) {
        break;
      }
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      await onLine(line);
    }
  }
}

function isDaemonFrame(value: unknown): value is DaemonFrame {
  if (!baseFrame(value)) {
    return false;
  }
  const frame = value as Record<string, unknown>;
  return FRAME_ACTIONS.includes(frame.action as never);
}

function isBridgeFrame(value: unknown): value is BridgeFrame {
  if (!baseFrame(value)) {
    return false;
  }
  const frame = value as Record<string, unknown>;
  return frame.event === "data" || frame.event === "exit" || frame.event === "error" || frame.event === "ready" || frame.event === "pong";
}

function baseFrame(value: unknown): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const frame = value as Record<string, unknown>;
  return typeof frame.id === "string" && CHANNEL_TYPES.includes(frame.channel as never) && "payload" in frame;
}
