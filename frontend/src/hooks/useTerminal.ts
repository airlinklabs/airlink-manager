import { useEffect, useRef } from "react";
import { subscribeChannel, sendWsMessage } from "./useWebSocket.ts";
import { useTerminalStore } from "../store/terminal.store.ts";

export function useTerminal(channelId: string) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const setConnected = useTerminalStore((state) => state.setConnected);

  useEffect(() => {
    if (!containerRef.current || !channelId) return;

    let disposed = false;
    let cleanupFn: (() => void) | null = null;

    Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
      import("@xterm/addon-web-links"),
    ]).then(([xterm, fit, links]) => {
      if (disposed || !containerRef.current) return;

      const terminal = new xterm.Terminal({
        convertEol: true,
        fontSize: 14,
        cursorBlink: true,
        theme: {
          background: "#000000",
          foreground: "#ffffff",
          cursor: "#ffffff",
        },
      });
      const fitAddon = new fit.FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(new links.WebLinksAddon());
      terminal.open(containerRef.current);
      fitAddon.fit();
      terminal.focus();

      let opened = false;
      const openChannel = () => {
        if (opened) return;
        opened = true;
        sendWsMessage({
          type: "channel.open",
          channelId,
          channel: "terminal",
          payload: { cols: terminal.cols, rows: terminal.rows }
        });
      };
      openChannel();

      // Subscribe to server messages for this channel
      const unsub = subscribeChannel(channelId, (msg) => {
        if (disposed) return;
        if (msg.type === "channel.ready") {
          setConnected(channelId, true);
        } else if (msg.type === "channel.data" && typeof msg.data === "string") {
          terminal.write(msg.data);
        } else if (msg.type === "channel.exit") {
          setConnected(channelId, false);
          terminal.writeln(`\r\n\x1b[33mSession ended (code ${msg.code ?? 0})\x1b[0m`);
        } else if (msg.type === "channel.error") {
          terminal.writeln(`\r\n\x1b[31mError: ${String(msg.message)}\x1b[0m`);
        }
      });

      // User input → bridge
      terminal.onData((data) => {
        if (!disposed) sendWsMessage({ type: "channel.data", channelId, data });
      });

      // Resize → bridge
      terminal.onResize(({ cols, rows }) => {
        if (!disposed) sendWsMessage({ type: "channel.resize", channelId, cols, rows });
      });

      // Resize observer for container
      const ro = new ResizeObserver(() => { if (!disposed) fitAddon.fit(); });
      if (containerRef.current) ro.observe(containerRef.current);

      cleanupFn = () => {
        unsub();
        ro.disconnect();
        if (opened) {
          sendWsMessage({ type: "channel.close", channelId });
        }
        setConnected(channelId, false);
        terminal.dispose();
      };

      if (disposed) {
        cleanupFn();
        cleanupFn = null;
      }
    });

    return () => {
      disposed = true;
      if (cleanupFn) {
        cleanupFn();
        cleanupFn = null;
      }
    };
  }, [channelId, setConnected]);

  return containerRef;
}
