import type { DaemonFrame } from "../../shared/types.ts";
import { validateUsername } from "../../shared/validate.ts";
import type { ChannelHandler, BridgeContext } from "../index.ts";
import { BaseChannel, payloadObject } from "./helpers.ts";

export class UsersChannel extends BaseChannel implements ChannelHandler {
  constructor(context: BridgeContext) {
    super(context);
  }

  async open(frame: DaemonFrame): Promise<void> {
    const payload = payloadObject(frame);
    const action = typeof payload.action === "string" ? payload.action : "list";
    if (action === "list") {
      const passwd = await Bun.file("/etc/passwd").text();
      this.ready(frame);
      this.emitData(frame, {
        users: passwd
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [username, , uid, gid, gecos, home, shell] = line.split(":");
            const uidN = Number(uid);
            if (uidN > 0 && uidN < 1000 && !["root", "nobody"].includes(username ?? "")) {
              return null;
            }
            return { username, uid: uidN, gid: Number(gid), gecos, home, shell };
          })
          .filter(Boolean)
      });
      this.exit(frame, 0);
      return;
    }
    const username = validateUsername(payload.username);
    const command = action === "lock"
      ? ["sudo", "-n", "usermod", "-L", username]
      : action === "unlock"
        ? ["sudo", "-n", "usermod", "-U", username]
        : null;
    if (!command) {
      throw new Error("unsupported user action");
    }
    const proc = Bun.spawn(command, { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    this.ready(frame);
    this.emitData(frame, { stdout, stderr, code });
    this.exit(frame, code);
  }
}
