import { X } from "lucide-react";
import { Badge } from "../../ui/Badge.tsx";
import type { TerminalTab as Tab } from "../../../store/terminal.store.ts";

export function TerminalTab({ tab, active, onSelect, onClose }: { tab: Tab; active: boolean; onSelect(): void; onClose(): void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors duration-150 ${active ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "text-[var(--theme-text-body)] hover:bg-[var(--theme-bg-hover)]"}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <span>{tab.title}</span>
      <Badge status={tab.connected ? "success" : "warning"}>{tab.connected ? "Connected" : "Connecting"}</Badge>
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--theme-text-body)] hover:bg-[var(--theme-bg-hover)] hover:text-[var(--theme-text-primary)]"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="Close terminal"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
