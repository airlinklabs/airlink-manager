import { useEffect, useRef } from "react";

export function useTerminal(channelId: string) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!containerRef.current || !channelId) {
      return;
    }
    let disposed = false;
    Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
      import("@xterm/addon-web-links"),
      import("@xterm/addon-webgl")
    ]).then(([xterm, fit, links, webgl]) => {
      if (disposed || !containerRef.current) {
        return;
      }
      const terminal = new xterm.Terminal({ convertEol: true, fontSize: 14, cursorBlink: true });
      const fitAddon = new fit.FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(new links.WebLinksAddon());
      terminal.loadAddon(new webgl.WebglAddon());
      terminal.open(containerRef.current);
      fitAddon.fit();
      terminal.writeln("Airlink terminal ready");
    });
    return () => {
      disposed = true;
    };
  }, [channelId]);
  return containerRef;
}
