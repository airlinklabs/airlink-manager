import * as ProgressPrimitive from "@radix-ui/react-progress";

export function Progress({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <ProgressPrimitive.Root className="h-2 overflow-hidden rounded-full bg-[var(--theme-bg-hover)]">
      <ProgressPrimitive.Indicator className="h-full bg-[var(--theme-accent)] transition-transform duration-150" style={{ transform: `translateX(-${100 - clamped}%)` }} />
    </ProgressPrimitive.Root>
  );
}
