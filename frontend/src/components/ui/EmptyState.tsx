import type { LucideIcon } from "lucide-react";
import { Button } from "./Button.tsx";

export function EmptyState({ icon: Icon, title, message, action }: { icon: LucideIcon; title: string; message?: string; action?: { label: string; onClick(): void } }) {
  return (
    <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-card)] p-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-[var(--theme-text-muted)]" />
      <h3 className="mt-3 text-sm font-semibold text-[var(--theme-text-primary)]">{title}</h3>
      {message ? <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--theme-text-body)]">{message}</p> : null}
      {action ? (
        <Button className="mt-4" variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
