import type { BridgeFrame, ChannelType, DaemonFrame } from "../shared/types.ts";
import { errorToPayload } from "../shared/errors.ts";
import { encodeFrame, readDaemonFrames } from "./protocol.ts";
import { TerminalChannel } from "./channels/terminal.ts";
import { ExecChannel } from "./channels/exec.ts";
import { StreamChannel } from "./channels/stream.ts";
import { FsReadChannel } from "./channels/fsread.ts";
import { FsWriteChannel } from "./channels/fswrite.ts";
import { FsListChannel } from "./channels/fslist.ts";
import { MetricsChannel } from "./channels/metrics.ts";
import { SystemdChannel } from "./channels/systemd.ts";
import { DockerChannel } from "./channels/docker.ts";
import { UsersChannel } from "./channels/users.ts";

export type ChannelHandler = {
  open(frame: DaemonFrame): Promise<void>;
  data?(frame: DaemonFrame): Promise<void>;
  resize?(frame: DaemonFrame): Promise<void>;
  close?(frame: DaemonFrame): Promise<void>;
};

export type BridgeContext = {
  emit(frame: BridgeFrame): void;
};

export async function runBridge(argv: string[]): Promise<void> {
  const uid = readNumericArg(argv, "--uid");
  const gid = readNumericArg(argv, "--gid");
  if (uid === 0 || process.getuid?.() === 0) {
    throw new Error("bridge must not run as root");
  }
  if (process.getuid?.() !== undefined && process.getuid() !== uid) {
    throw new Error(`bridge uid mismatch: expected ${uid}, got ${process.getuid()}`);
  }
  if (process.getgid?.() !== undefined && process.getgid() !== gid) {
    throw new Error(`bridge gid mismatch: expected ${gid}, got ${process.getgid()}`);
  }

  process.env.HOME = await resolveHomeDir(uid);

  const writer = Bun.stdout.writer();
  const context: BridgeContext = {
    emit(frame) {
      writer.write(encodeFrame(frame));
      writer.flush();
    }
  };
  const channels = new Map<string, ChannelHandler>();

  await readDaemonFrames(Bun.stdin.stream(), async (frame) => {
    try {
      if (frame.action === "ping") {
        context.emit({ id: frame.id, channel: frame.channel, event: "pong", payload: null });
        return;
      }
      if (frame.action === "open") {
        const handler = createChannel(frame.channel, context);
        channels.set(frame.id, handler);
        await handler.open(frame);
        return;
      }
      const handler = channels.get(frame.id);
      if (!handler) {
        throw new Error("channel is not open");
      }
      if (frame.action === "data" && handler.data) {
        await handler.data(frame);
      } else if (frame.action === "resize" && handler.resize) {
        await handler.resize(frame);
      } else if (frame.action === "close") {
        await handler.close?.(frame);
        channels.delete(frame.id);
      }
    } catch (error) {
      const payload = errorToPayload(error);
      context.emit({ id: frame.id, channel: frame.channel, event: "error", payload: { message: payload.message, code: payload.code } });
    }
  });
}

function createChannel(channel: ChannelType, context: BridgeContext): ChannelHandler {
  switch (channel) {
    case "terminal":
      return new TerminalChannel(context);
    case "exec":
      return new ExecChannel(context);
    case "stream":
      return new StreamChannel(context);
    case "fsread":
      return new FsReadChannel(context);
    case "fswrite":
      return new FsWriteChannel(context);
    case "fslist":
      return new FsListChannel(context);
    case "metrics":
      return new MetricsChannel(context);
    case "systemd":
      return new SystemdChannel(context);
    case "docker":
      return new DockerChannel(context);
    case "users":
      return new UsersChannel(context);
  }
}

async function resolveHomeDir(uid: number): Promise<string> {
  const passwd = await Bun.file("/etc/passwd").text().catch(() => "");
  for (const line of passwd.split("\n")) {
    const parts = line.split(":");
    if (Number(parts[2]) === uid && parts[5]) {
      process.env.USER = parts[0] ?? process.env.USER;
      process.env.LOGNAME = parts[0] ?? process.env.LOGNAME;
      process.env.SHELL = parts[6] ?? process.env.SHELL;
      return parts[5];
    }
  }
  return `/home/${process.env.USER ?? "nobody"}`;
}

function readNumericArg(argv: string[], name: "--uid" | "--gid"): number {
  const prefix = `${name}=`;
  const arg = argv.find((item) => item.startsWith(prefix));
  if (!arg) {
    throw new Error(`${name} is required`);
  }
  const value = Number(arg.slice(prefix.length));
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}
