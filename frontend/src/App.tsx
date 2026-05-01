import { useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/shell/Layout.tsx";
import { ToastContainer } from "./components/ui/ToastContainer.tsx";
import { DashboardPage } from "./components/pages/dashboard/DashboardPage.tsx";
import { TerminalPage } from "./components/pages/terminal/TerminalPage.tsx";
import { FileBrowserPage } from "./components/pages/files/FileBrowserPage.tsx";
import { DockerPage } from "./components/pages/docker/DockerPage.tsx";
import { ServicesPage } from "./components/pages/systemd/ServicesPage.tsx";
import { UsersPage } from "./components/pages/users/UsersPage.tsx";
import { SettingsPage } from "./components/pages/settings/SettingsPage.tsx";
import { AccountPage } from "./components/pages/account/AccountPage.tsx";
import { LoginPage } from "./components/pages/auth/LoginPage.tsx";
import { AddonPage } from "./components/pages/addons/AddonPage.tsx";
import { useMe, useWsToken } from "./api/auth.ts";
import { useAuthStore } from "./store/auth.store.ts";
import { useWebSocket } from "./hooks/useWebSocket.ts";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false
    }
  }
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
      <ToastContainer />
    </QueryClientProvider>
  );
}

function AppShell() {
  const [path, setPath] = useState(window.location.pathname);
  const user = useAuthStore((state) => state.user);
  const wsToken = useAuthStore((state) => state.wsToken);
  const me = useMe();
  const { mutate: loadWsToken } = useWsToken();
  const { status: wsStatus } = useWebSocket();
  const hasFetchedWsToken = useRef(false);

  useEffect(() => {
    const listener = () => setPath(window.location.pathname);
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);

  useEffect(() => {
    if (!user || wsToken || hasFetchedWsToken.current) {
      return;
    }
    hasFetchedWsToken.current = true;
    loadWsToken();
  }, [loadWsToken, user, wsToken]);

  const navigate = (next: string) => {
    window.history.pushState({}, "", next);
    setPath(next);
  };

  const page = useMemo(() => route(path), [path]);

  if (!user && !me.isLoading) {
    return <LoginPage />;
  }

  return (
    <Layout currentPath={path} navigate={navigate}>
      {page}
      <div className="fixed bottom-4 right-4 rounded-full bg-[var(--theme-bg-card)] px-3 py-2 text-xs text-[var(--theme-text-body)] shadow-card">
        WebSocket: {wsStatus}
      </div>
    </Layout>
  );
}

function route(path: string) {
  if (path === "/terminal") return <TerminalPage />;
  if (path === "/files") return <FileBrowserPage />;
  if (path === "/docker") return <DockerPage />;
  if (path === "/services") return <ServicesPage />;
  if (path === "/users") return <UsersPage />;
  if (path === "/settings") return <SettingsPage />;
  if (path === "/account") return <AccountPage />;
  if (path.startsWith("/addons/")) return <AddonPage />;
  return <DashboardPage />;
}
