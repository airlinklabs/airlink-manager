import { useTerminal } from "../../../hooks/useTerminal.ts";

export default function TerminalPane({ channelId }: { channelId: string }) {
  const ref = useTerminal(channelId);
  return (
    <div className="flex min-h-[32rem] w-full flex-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-black">
      <div ref={ref} className="h-full w-full" />
    </div>
  );
}
