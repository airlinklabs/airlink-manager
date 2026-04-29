import { useTerminal } from "../../../hooks/useTerminal.ts";

export default function TerminalPane({ channelId }: { channelId: string }) {
  const ref = useTerminal(channelId);
  return <div ref={ref} className="h-[calc(100vh-14rem)] min-h-80 rounded-xl bg-black p-2" />;
}
