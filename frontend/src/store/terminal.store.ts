import { create } from "zustand";

export type TerminalTab = {
  id: string;
  title: string;
  connected: boolean;
};

type TerminalState = {
  tabs: TerminalTab[];
  activeId: string | null;
  addTab(): string;
  closeTab(id: string): void;
  setActive(id: string): void;
  setConnected(id: string, connected: boolean): void;
};

export const useTerminalStore = create<TerminalState>((set, get) => ({
  tabs: [],
  activeId: null,
  addTab: () => {
    const id = crypto.randomUUID();
    set((state) => ({
      tabs: [...state.tabs, { id, title: `Terminal ${state.tabs.length + 1}`, connected: false }],
      activeId: id
    }));
    return id;
  },
  closeTab: (id) =>
    set((state) => {
      const tabs = state.tabs.filter((tab) => tab.id !== id);
      return { tabs, activeId: state.activeId === id ? tabs[0]?.id ?? null : state.activeId };
    }),
  setActive: (activeId) => set({ activeId }),
  setConnected: (id, connected) =>
    set({ tabs: get().tabs.map((tab) => (tab.id === id ? { ...tab, connected } : tab)) })
}));
