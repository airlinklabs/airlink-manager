import { Container, FolderOpen, LayoutDashboard, Settings2, SlidersHorizontal, Terminal, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Role = "owner" | "admin" | "user" | "banned";

export type NavItem = {
  label: string;
  icon: LucideIcon;
  path: string;
  roles: readonly Exclude<Role, "banned">[];
};

export const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", roles: ["user", "admin", "owner"] },
  { label: "Terminal", icon: Terminal, path: "/terminal", roles: ["user", "admin", "owner"] },
  { label: "Files", icon: FolderOpen, path: "/files", roles: ["user", "admin", "owner"] },
  { label: "Services", icon: Settings2, path: "/services", roles: ["user", "admin", "owner"] },
  { label: "Docker", icon: Container, path: "/docker", roles: ["user", "admin", "owner"] },
  { label: "Users", icon: Users, path: "/users", roles: ["admin", "owner"] },
  { label: "Settings", icon: SlidersHorizontal, path: "/settings", roles: ["owner"] }
] as const satisfies readonly NavItem[];

export const WS_MESSAGE_TYPES = {
  channelOpen: "channel.open",
  channelData: "channel.data",
  channelResize: "channel.resize",
  channelClose: "channel.close"
} as const;
