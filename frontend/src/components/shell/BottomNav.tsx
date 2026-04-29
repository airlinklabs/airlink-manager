import { MoreHorizontal } from "lucide-react";
import { NAV_ITEMS } from "../../lib/constants.ts";
import { cn } from "../../lib/cn.ts";
import { useAuth } from "../../hooks/useAuth.ts";

export function BottomNav({ currentPath, navigate }: { currentPath: string; navigate(path: string): void }) {
  const { user } = useAuth();
  const items = NAV_ITEMS.filter((item) => user && (item.roles as readonly string[]).includes(user.role));
  const visible = items.slice(0, 4);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-5 border-t border-[var(--theme-border)] bg-[var(--theme-bg)] pb-[env(safe-area-inset-bottom)] md:hidden">
      {visible.map((item) => {
        const Icon = item.icon;
        const active = currentPath === item.path;
        return (
          <button key={item.path} className={cn("flex flex-col items-center justify-center gap-1 text-xs text-[var(--theme-nav-text)]", active && "text-[var(--theme-active-nav-text)]")} onClick={() => navigate(item.path)}>
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </button>
        );
      })}
      <button className="flex flex-col items-center justify-center gap-1 text-xs text-[var(--theme-nav-text)]" onClick={() => navigate(items[4]?.path ?? "/")}>
        <MoreHorizontal className="h-4 w-4" />
        <span>More</span>
      </button>
    </nav>
  );
}
