import { useCallback } from "react";
import { useWebSocket } from "./useWebSocket.ts";

export function useChannel(channel: string) {
  const { status, send } = useWebSocket();
  const open = useCallback(
    (channelId: string, payload: unknown) => send({ type: "channel.open", channelId, channel, payload }),
    [channel, send]
  );
  const close = useCallback((channelId: string) => send({ type: "channel.close", channelId }), [send]);
  return { status, open, close, send };
}
