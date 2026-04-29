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
    const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe", stdin: null });
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ]);
    this.ready(frame);
    this.emitData(frame, { stdout, stderr, code });
    this.exit(frame, code);
  }
}
