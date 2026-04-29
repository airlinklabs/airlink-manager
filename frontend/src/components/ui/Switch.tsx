import * as SwitchPrimitive from "@radix-ui/react-switch";

export function Switch({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange(value: boolean): void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-[var(--theme-text-body)]">
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="h-6 w-11 rounded-full bg-gray-300 p-0.5 data-[state=checked]:bg-[var(--theme-accent)] dark:bg-gray-700"
      >
        <SwitchPrimitive.Thumb className="block h-5 w-5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-5" />
      </SwitchPrimitive.Root>
      {label}
    </label>
  );
}
