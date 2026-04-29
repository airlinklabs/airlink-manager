import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn.ts";

export function Select({ value, onValueChange, items, placeholder }: { value?: string; onValueChange(value: string): void; items: string[]; placeholder?: string }) {
  const rootProps = value === undefined ? { onValueChange } : { value, onValueChange };
  return (
    <SelectPrimitive.Root {...rootProps}>
      <SelectPrimitive.Trigger className="flex h-10 w-full items-center justify-between rounded-lg border border-[var(--theme-border-input)] bg-[var(--theme-bg-input)] px-3 text-sm">
        <SelectPrimitive.Value placeholder={placeholder} />
        <ChevronDown className="h-4 w-4 text-[var(--theme-text-muted)]" />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="z-50 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-card)] p-1 shadow-[var(--shadow-float)]">
          <SelectPrimitive.Viewport>
            {items.map((item) => (
              <SelectPrimitive.Item key={item} value={item} className={cn("cursor-pointer rounded-lg px-3 py-2 text-sm outline-none hover:bg-[var(--theme-bg-hover)]")}>
                <SelectPrimitive.ItemText>{item}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
