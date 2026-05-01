import { lazy, Suspense, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, RotateCw, Trash2 } from "lucide-react";
import { pageTransition, pageVariants } from "../../../lib/motion.ts";
import { useTerminalStore } from "../../../store/terminal.store.ts";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import { Spinner } from "../../ui/Spinner.tsx";
import { PageHeader } from "../../shell/PageHeader.tsx";
import { TerminalTab } from "./TerminalTab.tsx";

const TerminalPane = lazy(() => import("./TerminalPane.tsx"));

export function TerminalPage() {
  const tabs = useTerminalStore((state) => state.tabs);
  const activeId = useTerminalStore((state) => state.activeId);
  const addTab = useTerminalStore((state) => state.addTab);
  const closeTab = useTerminalStore((state) => state.closeTab);
  const setActive = useTerminalStore((state) => state.setActive);

  useEffect(() => {
    if (tabs.length === 0) {
      addTab();
    }
  }, [addTab, tabs.length]);

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <PageHeader title="Terminal" description="User-scoped PTY sessions through the bridge." action={<Button onClick={() => addTab()}><Plus className="h-4 w-4" />New Tab</Button>} />
      <Card className="flex min-h-[55vh] flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => (
            <TerminalTab key={tab.id} tab={tab} active={tab.id === activeId} onSelect={() => setActive(tab.id)} onClose={() => closeTab(tab.id)} />
          ))}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="icon" aria-label="Reconnect"><RotateCw className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Clear"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        {activeId ? (
          <Suspense fallback={<Spinner label="Loading terminal" />}>
            <TerminalPane channelId={activeId} />
          </Suspense>
        ) : (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--theme-text-body)]">
            No terminal session available.
          </div>
        )}
      </Card>
    </motion.div>
  );
}
