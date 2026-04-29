import { forwardRef } from "react";
import { cn } from "../../lib/cn.ts";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-lg border border-[var(--theme-border-input)] bg-[var(--theme-bg-input)] px-3 text-sm text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-muted)]",
      className
    )}
    {...props}
  />
));

Input.displayName = "Input";
