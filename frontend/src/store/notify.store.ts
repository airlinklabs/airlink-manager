import { create } from "zustand";

export type NotificationLevel = "info" | "success" | "warning" | "error";

export type Notification = {
  id: string;
  level: NotificationLevel;
  message: string;
  read: boolean;
};

type NotifyState = {
  notifications: Notification[];
  push(level: NotificationLevel, message: string): void;
  dismiss(id: string): void;
  markAllRead(): void;
};

export const useNotifyStore = create<NotifyState>((set) => ({
  notifications: [],
  push: (level, message) =>
    set((state) => ({
      notifications: [{ id: crypto.randomUUID(), level, message, read: false }, ...state.notifications].slice(0, 100)
    })),
  dismiss: (id) => set((state) => ({ notifications: state.notifications.filter((item) => item.id !== id) })),
  markAllRead: () => set((state) => ({ notifications: state.notifications.map((item) => ({ ...item, read: true })) }))
}));
