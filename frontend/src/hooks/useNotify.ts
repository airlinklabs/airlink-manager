import { useNotifyStore, type NotificationLevel } from "../store/notify.store.ts";

export function useNotify() {
  const push = useNotifyStore((state) => state.push);
  return {
    notify: (level: NotificationLevel, message: string) => push(level, message)
  };
}
