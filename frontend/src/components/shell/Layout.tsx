import { Sidebar } from "./Sidebar.tsx";
import { TopBar } from "./TopBar.tsx";
import { BottomNav } from "./BottomNav.tsx";
import { useSidebarStore } from "../../store/sidebar.store.ts";

export function Layout({ currentPath, navigate, children }: { currentPath: string; navigate(path: string): void; children: React.ReactNode }) {
  const collapsed = useSidebarStore((state) => state.collapsed);
  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text-primary)]">
      <Sidebar currentPath={currentPath} navigate={navigate} />
      <div className={collapsed ? "md:ml-16" : "md:ml-60"}>
        <TopBar />
        <main className="min-h-[calc(100vh-3.5rem)] px-4 py-4 pb-20 md:min-h-[calc(100vh-4rem)] md:px-6 md:pb-6">{children}</main>
      </div>
      <BottomNav currentPath={currentPath} navigate={navigate} />
    </div>
  );
}
