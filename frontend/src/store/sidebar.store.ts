import { create } from "zustand";

type SidebarState = {
  collapsed: boolean;
  activeRoute: string;
  setCollapsed(collapsed: boolean): void;
  setActiveRoute(route: string): void;
};

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  activeRoute: "/",
  setCollapsed: (collapsed) => set({ collapsed }),
  setActiveRoute: (activeRoute) => set({ activeRoute })
}));
