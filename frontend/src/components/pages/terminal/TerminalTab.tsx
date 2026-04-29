import { X } from "lucide-react";
import { Button } from "../../ui/Button.tsx";
import type { TerminalTab as Tab } from "../../../store/terminal.store.ts";

export function TerminalTab({ tab, active, onSelect, onClose }: { tab: Tab; active: boolean; onSelect(): void; onClose(): void }) {
  return (
    <button className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${active ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "text-[var(--theme-text-body)] hover:bg-[var(--theme-bg-hover)]"}`} onClick={onSelect}>
      <span>{tab.title}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="Close terminal"
      >
        <X className="h-3 w-3" />
      </Button>
    </button>
  );
}
