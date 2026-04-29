import { forwardRef } from "react";
import { cn } from "../../lib/cn.ts";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-28 w-full rounded-lg border border-[var(--theme-border-input)] bg-[var(--theme-bg-input)] px-3 py-2 text-sm text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-muted)]",
      className
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
