import type { DaemonFrame } from "../../shared/types.ts";
import { validateServiceName } from "../../shared/validate.ts";
import type { ChannelHandler, BridgeContext } from "../index.ts";
import { BaseChannel, payloadObject } from "./helpers.ts";

export class SystemdChannel extends BaseChannel implements ChannelHandler {
  constructor(context: BridgeContext) {
    super(context);
  }

  async open(frame: DaemonFrame): Promise<void> {
    const payload = payloadObject(frame);
    const action = typeof payload.action === "string" ? payload.action : "list";
    if (action === "list") {
      await this.run(frame, ["systemctl", "list-units", "--type=service", "--all", "--output=json"]);
      return;
    }
    if (action === "status") {
      const service = validateServiceName(payload.service);
      await this.run(frame, ["systemctl", "status", service, "--output=json"]);
      return;
    }
    const service = validateServiceName(payload.service);
    if (action === "logs") {
      await this.run(frame, ["journalctl", "-u", service, "-n", "200", "--no-pager"]);
      return;
    }
    if (["start", "stop", "restart", "reload", "enable", "disable"].includes(action)) {
      await this.run(frame, ["sudo", "-n", "systemctl", action, service]);
      return;
    }
    if (action === "cat") {
      await this.run(frame, ["systemctl", "cat", service]);
      return;
    }
    throw new Error("unsupported systemd action");
  }

  private async run(frame: DaemonFrame, command: string[]): Promise<void> {
    const proc = Bun.spawn(command, { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    this.ready(frame);
    this.emitData(frame, { stdout, stderr, code });
    this.exit(frame, code);
  }
}
