import type { DaemonFrame } from "../../shared/types.ts";
import { validateDockerId } from "../../shared/validate.ts";
import type { ChannelHandler, BridgeContext } from "../index.ts";
import { BaseChannel, payloadObject } from "./helpers.ts";

export class DockerChannel extends BaseChannel implements ChannelHandler {
  constructor(context: BridgeContext) {
    super(context);
  }

  async open(frame: DaemonFrame): Promise<void> {
    const payload = payloadObject(frame);
    const action = typeof payload.action === "string" ? payload.action : "info";
    if (action === "logs") {
      const id = validateDockerId(payload.id);
      await this.run(frame, ["docker", "logs", "--tail=500", id]);
      return;
    }
    if (action === "stats") {
      const id = validateDockerId(payload.id);
      await this.run(frame, ["docker", "stats", "--no-stream", id]);
      return;
    }
    await this.run(frame, ["docker", "info", "--format", "json"]);
  }

  private async run(frame: DaemonFrame, command: string[]): Promise<void> {
    const proc = Bun.spawn(command, { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    this.ready(frame);
    this.emitData(frame, { stdout, stderr, code });
    this.exit(frame, code);
  }
}
