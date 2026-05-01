import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/auth.store.ts";
import { useNotifyStore } from "../store/notify.store.ts";

type Status = "idle" | "connecting" | "open" | "closed";
type MessageListener = (data: Record<string, unknown>) => void;

// Global singleton WS + listener registry so terminal panes can subscribe
const listeners = new Map<string, Set<MessageListener>>();
let globalWs: WebSocket | null = null;
const pendingMessages: unknown[] = [];

export function subscribeChannel(channelId: string, fn: MessageListener): () => void {
  if (!listeners.has(channelId)) listeners.set(channelId, new Set());
  listeners.get(channelId)!.add(fn);
  return () => listeners.get(channelId)?.delete(fn);
}

export function sendWsMessage(value: unknown): void {
  if (globalWs?.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify(value));
    return;
  }

  pendingMessages.push(value);
}

export function reconnectDelay(attempt: number): number {
  const base = Math.min(30_000, 1000 * 2 ** attempt);
  return base + Math.random() * 1000;
}

export function useWebSocket() {
  const token = useAuthStore((state) => state.wsToken);
  const notify = useNotifyStore((state) => state.push);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const send = useCallback((value: unknown) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(value));
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }
    let stopped = false;
    let attempt = 0;
    let heartbeat: number | null = null;

    const connect = () => {
      setStatus("connecting");
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${window.location.host}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      globalWs = ws;
      ws.addEventListener("open", () => {
        attempt = 0;
        setStatus("open");
        heartbeat = window.setInterval(() => ws.send(JSON.stringify({ type: "ping" })), 30_000);
        while (pendingMessages.length > 0) {
          const payload = pendingMessages.shift();
          if (payload) ws.send(JSON.stringify(payload));
        }
      });
      ws.addEventListener("message", (event) => {
        const data = JSON.parse(String(event.data)) as Record<string, unknown>;
        if (data.type === "notification" && data.level && data.message) {
          notify(data.level as "info" | "success" | "warning" | "error", data.message as string);
        }
        // Route to per-channel listeners
        if (typeof data.channelId === "string") {
          listeners.get(data.channelId)?.forEach((fn) => fn(data));
        }
      });
      ws.addEventListener("close", () => {
        if (heartbeat !== null) {
          window.clearInterval(heartbeat);
        }
        if (globalWs === ws) globalWs = null;
        setStatus("closed");
        if (!stopped && attempt < 10) {
          window.setTimeout(connect, reconnectDelay(attempt));
          attempt += 1;
        }
      });
    };

    connect();
    return () => {
      stopped = true;
      wsRef.current?.close();
    };
  }, [notify, token]);

  return { status, send };
}
