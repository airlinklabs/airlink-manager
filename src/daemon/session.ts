import type { BridgeFrame, DaemonFrame, ServerMessage, WebSession } from "../shared/types.ts";
import { SELF_BINARY_PATH } from "../shared/constants.ts";
import { encodeFrame, readFrameLines } from "../bridge/protocol.ts";
import { log } from "./logger.ts";

export type BridgeProcess = {
  process: Bun.Subprocess<"pipe", "pipe", "pipe">;
  writer: { write(data: string | Uint8Array): number | Promise<number>; flush?: () => void };
  restarts: number;
  degraded: boolean;
};

export type ManagedSession = {
  session: WebSession;
  bridge: BridgeProcess | null;
  sockets: Set<ServerWebSocket>;
  lastActivity: number;
  uid: number;
  gid: number;
};

export type ServerWebSocket = {
  send(data: string | Uint8Array): number;
  close(code?: number, reason?: string): void;
  readyState?: number;
};

export class SessionManager {
  private readonly sessions = new Map<string, ManagedSession>();

  get(session: WebSession): ManagedSession {
    const existing = this.sessions.get(session.id);
    if (existing) {
      existing.session = session;
      existing.lastActivity = Date.now();
      return existing;
    }
    const created: ManagedSession = {
      session,
      bridge: null,
      sockets: new Set(),
      lastActivity: Date.now(),
      uid: 0,
      gid: 0
    };
    this.sessions.set(session.id, created);
    return created;
  }

  async ensureBridge(session: WebSession, uid: number, gid: number): Promise<BridgeProcess> {
    const managed = this.get(session);
    managed.uid = uid;
    managed.gid = gid;
    if (managed.bridge && !managed.bridge.degraded) {
      return managed.bridge;
    }
    managed.bridge = await this.spawnBridge(managed, uid, gid, managed.bridge?.restarts ?? 0);
    return managed.bridge;
  }

  attachSocket(session: WebSession, socket: ServerWebSocket): ManagedSession {
    const managed = this.get(session);
    for (const existing of managed.sockets) {
      existing.close(4000, "new connection opened");
    }
    managed.sockets.clear();
    managed.sockets.add(socket);
    return managed;
  }

  detachSocket(sessionId: string, socket: ServerWebSocket): void {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      return;
    }
    managed.sockets.delete(socket);
    if (managed.sockets.size === 0) {
      managed.lastActivity = Date.now();
    }
  }

  async sendToBridge(sessionId: string, frame: DaemonFrame): Promise<void> {
    const bridge = this.sessions.get(sessionId)?.bridge;
    if (!bridge || bridge.degraded) {
      throw new Error("bridge unavailable");
    }
    await bridge.writer.write(encodeFrame(frame));
    bridge.writer.flush?.();
  }

  kill(sessionId: string): void {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      return;
    }
    managed.bridge?.process.kill();
    for (const socket of managed.sockets) {
      socket.close(1000, "session closed");
    }
    this.sessions.delete(sessionId);
  }

  private async spawnBridge(managed: ManagedSession, uid: number, gid: number, restarts: number): Promise<BridgeProcess> {
    if (uid === 0) {
      throw new Error("refusing to spawn bridge as root");
    }
    const spawnOptions: Parameters<typeof Bun.spawn<"pipe", "pipe", "pipe">>[1] & { uid?: number; gid?: number } = {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      uid,
      gid
    };
    const bridgeProc = Bun.spawn([SELF_BINARY_PATH, "--bridge", `--uid=${uid}`, `--gid=${gid}`], spawnOptions);
    const bridge: BridgeProcess = {
      process: bridgeProc,
      writer: bridgeProc.stdin,
      restarts,
      degraded: false
    };

    readFrameLines(bridgeProc.stdout, (frame) => {
      this.broadcast(managed, bridgeFrameToServerMessage(frame));
    }).catch((error: unknown) => {
      if (error instanceof Error) {
        log("error", "bridge stdout reader failed", { error: error.message, sessionId: managed.session.id });
      }
    });

    new Response(bridgeProc.stderr).text().then((stderr) => {
      if (stderr.trim().length > 0) {
        log("warn", "bridge stderr", { sessionId: managed.session.id, stderr: stderr.slice(0, 2048) });
      }
    }).catch((error: unknown) => {
      if (error instanceof Error) {
        log("error", "bridge stderr reader failed", { error: error.message });
      }
    });

    bridgeProc.exited.then((code) => {
      log("warn", "bridge exited", { code, sessionId: managed.session.id });
      this.restartWithBackoff(managed, bridge).catch((error: unknown) => {
        if (error instanceof Error) {
          log("error", "bridge restart failed", { error: error.message });
        }
      });
    }).catch((error: unknown) => {
      if (error instanceof Error) {
        log("error", "bridge exit wait failed", { error: error.message });
      }
    });

    return bridge;
  }

  private async restartWithBackoff(managed: ManagedSession, bridge: BridgeProcess): Promise<void> {
    if (managed.sockets.size === 0) {
      return;
    }
    if (bridge.restarts >= 5) {
      bridge.degraded = true;
      this.broadcast(managed, {
        type: "notification",
        id: crypto.randomUUID(),
        level: "error",
        message: "Bridge process unstable - please re-login"
      });
      return;
    }
    const delay = Math.min(16_000, 1000 * 2 ** bridge.restarts);
    await Bun.sleep(delay);
    managed.bridge = await this.spawnBridge(managed, managed.uid, managed.gid, bridge.restarts + 1);
  }

  private broadcast(managed: ManagedSession, message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const socket of managed.sockets) {
      socket.send(data);
    }
  }
}

function bridgeFrameToServerMessage(frame: BridgeFrame): ServerMessage {
  if (frame.event === "ready") {
    return { type: "channel.ready", channelId: frame.id };
  }
  if (frame.event === "data") {
    return { type: "channel.data", channelId: frame.id, data: String(frame.payload) };
  }
  if (frame.event === "exit") {
    const code = typeof frame.payload === "number" ? frame.payload : 0;
    return { type: "channel.exit", channelId: frame.id, code };
  }
  if (frame.event === "error") {
    const payload = frame.payload as { message?: unknown; code?: unknown };
    const base = {
      type: "channel.error",
      channelId: frame.id,
      message: typeof payload.message === "string" ? payload.message : "Channel error"
    } satisfies ServerMessage;
    if (typeof payload.code === "string") {
      return { ...base, code: payload.code };
    }
    return base;
  }
  return { type: "pong" };
}
