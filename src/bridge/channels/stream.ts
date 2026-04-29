import type { DaemonFrame } from "../../shared/types.ts";
import { ValidationError } from "../../shared/errors.ts";
import type { ChannelHandler, BridgeContext } from "../index.ts";
import { BaseChannel, payloadObject } from "./helpers.ts";

export class StreamChannel extends BaseChannel implements ChannelHandler {
  private proc: Bun.Subprocess<"ignore", "pipe", "pipe"> | null = null;

  constructor(context: BridgeContext) {
    super(context);
  }

  async open(frame: DaemonFrame): Promise<void> {
    const payload = payloadObject(frame);
    if (!Array.isArray(payload.command) || !payload.command.every((part) => typeof part === "string" && part.length > 0)) {
      throw new ValidationError("command must be a non-empty string array");
    }
    this.proc = Bun.spawn(payload.command as string[], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    this.ready(frame);
    this.pipe(frame, this.proc.stdout).catch((error: unknown) => this.emitData(frame, String(error)));
    this.pipe(frame, this.proc.stderr).catch((error: unknown) => this.emitData(frame, String(error)));
    const code = await this.proc.exited;
    this.exit(frame, code);
  }

  async close(): Promise<void> {
    this.proc?.kill();
  }

  private async pipe(frame: DaemonFrame, stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      this.emitData(frame, decoder.decode(value, { stream: true }));
    }
  }
}
