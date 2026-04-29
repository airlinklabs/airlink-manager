import { ChevronLeft, ChevronRight, Server } from "lucide-react";
import { motion } from "framer-motion";
import { NAV_ITEMS } from "../../lib/constants.ts";
import { cn } from "../../lib/cn.ts";
import { useAuth } from "../../hooks/useAuth.ts";
import { useSidebarStore } from "../../store/sidebar.store.ts";
import { Button } from "../ui/Button.tsx";
import { Tooltip } from "../ui/Tooltip.tsx";

export function Sidebar({ currentPath, navigate }: { currentPath: string; navigate(path: string): void }) {
  const { user } = useAuth();
  const collapsed = useSidebarStore((state) => state.collapsed);
  const setCollapsed = useSidebarStore((state) => state.setCollapsed);
  const items = NAV_ITEMS.filter((item) => user && (item.roles as readonly string[]).includes(user.role));
  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.18 }}
      className="fixed left-0 top-0 hidden h-screen flex-col border-r border-[var(--theme-border)] bg-[var(--theme-bg-secondary)] md:flex"
    >
      <div className="flex h-16 items-center gap-2 px-4">
        <Server className="h-5 w-5 text-[var(--theme-accent)]" />
        {!collapsed ? <span className="truncate text-sm font-semibold">Airlink Panel</span> : null}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = currentPath === item.path;
          const button = (
            <button
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-[var(--theme-nav-text)] transition-colors hover:bg-[var(--theme-bg-hover)]",
                active && "bg-[var(--theme-bg-card)] font-medium text-[var(--theme-active-nav-text)] shadow-sm"
              )}
              onClick={() => navigate(item.path)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
            </button>
          );
          return collapsed ? (
            <Tooltip key={item.path} label={item.label}>
              {button}
            </Tooltip>
          ) : (
            <div key={item.path}>{button}</div>
          );
        })}
      </nav>
      <div className="flex h-16 items-center justify-between border-t border-[var(--theme-border)] px-3">
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.displayName}</p>
            <p className="text-xs text-[var(--theme-text-muted)]">{user?.role}</p>
          </div>
        ) : null}
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </motion.aside>
  );
}
