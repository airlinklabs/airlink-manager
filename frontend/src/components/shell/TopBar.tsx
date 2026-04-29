import { Bell, LogOut, Moon, Search, Server, Sun } from "lucide-react";
import { Button } from "../ui/Button.tsx";
import { Input } from "../ui/Input.tsx";
import { useLogout } from "../../api/auth.ts";
import { useNotifyStore } from "../../store/notify.store.ts";
import { useTheme } from "../../hooks/useTheme.ts";

export function TopBar() {
  const logout = useLogout();
  const unread = useNotifyStore((state) => state.notifications.filter((item) => !item.read).length);
  const { theme, setTheme } = useTheme();
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 md:h-16 md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <Server className="h-5 w-5 text-[var(--theme-accent)]" />
        <span className="text-sm font-semibold">Airlink</span>
      </div>
      <div className="hidden max-w-md flex-1 md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--theme-text-muted)]" />
          <Input className="pl-9" placeholder="Search servers, files, services" />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--theme-danger)]" /> : null}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => logout.mutate()} aria-label="Log out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
