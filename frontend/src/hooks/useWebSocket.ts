import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/auth.store.ts";
import { useNotifyStore } from "../store/notify.store.ts";

type Status = "idle" | "connecting" | "open" | "closed";

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
      ws.addEventListener("open", () => {
        attempt = 0;
        setStatus("open");
        heartbeat = window.setInterval(() => ws.send(JSON.stringify({ type: "ping" })), 30_000);
      });
      ws.addEventListener("message", (event) => {
        const data = JSON.parse(String(event.data)) as { type?: string; level?: "info" | "success" | "warning" | "error"; message?: string };
        if (data.type === "notification" && data.level && data.message) {
          notify(data.level, data.message);
        }
      });
      ws.addEventListener("close", () => {
        if (heartbeat !== null) {
          window.clearInterval(heartbeat);
        }
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
