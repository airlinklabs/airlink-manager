import { cn } from "../../lib/cn.ts";

type BadgeStatus = "success" | "danger" | "warning" | "info" | "neutral";

const classes: Record<BadgeStatus, string> = {
  success: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
  danger: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  neutral: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
};

const dots: Record<BadgeStatus, string> = {
  success: "bg-green-500",
  danger: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  neutral: "bg-gray-400"
};

export function Badge({ status = "neutral", children, className }: { status?: BadgeStatus; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", classes[status], className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dots[status])} />
      {children}
    </span>
  );
}
