import type { ServerWebSocket, SessionManager } from "./session.ts";
import type { ClientMessage, DaemonFrame, WebSession } from "../shared/types.ts";
import { CHANNEL_TYPES } from "../shared/types.ts";
import { verifyWsToken } from "./auth.ts";
import type { Queries } from "../db/queries.ts";

export type WsDeps = {
  queries: Queries;
  appSecret: () => string;
  sessions: SessionManager;
};

export async function authenticateWsRequest(request: Request, deps: WsDeps): Promise<WebSession> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    throw new Error("missing token");
  }
  const payload = await verifyWsToken(token, deps.appSecret());
  const session = deps.queries.findSession(payload.sessionId);
  if (!session || session.unix_username !== payload.username) {
    throw new Error("invalid session");
  }
  return session;
}

export function handleWsMessage(session: WebSession, socket: ServerWebSocket, data: string | Buffer, deps: WsDeps): void {
  const message = parseClientMessage(data);
  if (message.type === "ping") {
    socket.send(JSON.stringify({ type: "pong" }));
    return;
  }
  if (message.type === "pong") {
    return;
  }
  const frame: DaemonFrame = clientMessageToFrame(message);
  deps.sessions.sendToBridge(session.id, frame).catch((error: unknown) => {
    const text = error instanceof Error ? error.message : "bridge unavailable";
    socket.send(JSON.stringify({ type: "channel.error", channelId: frame.id, message: text, code: "BRIDGE_UNAVAILABLE" }));
  });
}

function parseClientMessage(data: string | Buffer): ClientMessage {
  const text = typeof data === "string" ? data : new TextDecoder().decode(data);
  const parsed = JSON.parse(text) as unknown;
  if (parsed === null || typeof parsed !== "object") {
    throw new Error("invalid WS message");
  }
  const candidate = parsed as Record<string, unknown>;
  if (candidate.type === "ping" || candidate.type === "pong") {
    return { type: candidate.type };
  }
  if (candidate.type === "channel.open") {
    const channel = candidate.channel;
    if (typeof candidate.channelId !== "string" || !CHANNEL_TYPES.includes(channel as never)) {
      throw new Error("invalid channel open");
    }
    return { type: "channel.open", channelId: candidate.channelId, channel: channel as never, payload: candidate.payload };
  }
  if (candidate.type === "channel.data") {
    if (typeof candidate.channelId !== "string" || typeof candidate.data !== "string") {
      throw new Error("invalid channel data");
    }
    return { type: "channel.data", channelId: candidate.channelId, data: candidate.data };
  }
  if (candidate.type === "channel.resize") {
    if (typeof candidate.channelId !== "string" || typeof candidate.cols !== "number" || typeof candidate.rows !== "number") {
      throw new Error("invalid resize");
    }
    return { type: "channel.resize", channelId: candidate.channelId, cols: candidate.cols, rows: candidate.rows };
  }
  if (candidate.type === "channel.close") {
    if (typeof candidate.channelId !== "string") {
      throw new Error("invalid close");
    }
    return { type: "channel.close", channelId: candidate.channelId };
  }
  throw new Error("unknown WS message");
}

function clientMessageToFrame(message: Exclude<ClientMessage, { type: "ping" } | { type: "pong" }>): DaemonFrame {
  if (message.type === "channel.open") {
    return { id: message.channelId, channel: message.channel, action: "open", payload: message.payload };
  }
  if (message.type === "channel.data") {
    return { id: message.channelId, channel: "terminal", action: "data", payload: { data: message.data } };
  }
  if (message.type === "channel.resize") {
    return { id: message.channelId, channel: "terminal", action: "resize", payload: { cols: message.cols, rows: message.rows } };
  }
  return { id: message.channelId, channel: "terminal", action: "close", payload: null };
}
