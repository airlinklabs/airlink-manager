import type { DaemonFrame } from "../../shared/types.ts";
import { ValidationError } from "../../shared/errors.ts";
import type { ChannelHandler, BridgeContext } from "../index.ts";
import { BaseChannel, payloadObject } from "./helpers.ts";

export class ExecChannel extends BaseChannel implements ChannelHandler {
  constructor(context: BridgeContext) {
    super(context);
  }

  async open(frame: DaemonFrame): Promise<void> {
    const payload = payloadObject(frame);
    if (!Array.isArray(payload.command) || !payload.command.every((part) => typeof part === "string" && part.length > 0)) {
      throw new ValidationError("command must be a non-empty string array");
    }
    const command = payload.command as string[];
    const timeoutMs = 30_000;
    const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe", stdin: null });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      proc.kill(9);
    }, timeoutMs);
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ]);
    clearTimeout(timeout);
    this.ready(frame);
    this.emitData(frame, { stdout, stderr, code, timedOut });
    this.exit(frame, timedOut ? 124 : code);
  }
}
