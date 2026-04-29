import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { Button } from "./Button.tsx";
import type { Notification } from "../../store/notify.store.ts";

const icon = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info
};

const colors = {
  success: "border-green-200 bg-green-50 text-green-800",
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-800"
};

export function Toast({ notification, onDismiss }: { notification: Notification; onDismiss(id: string): void }) {
  const Icon = icon[notification.level];
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${colors[notification.level]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1 text-sm">{notification.message}</p>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDismiss(notification.id)} aria-label="Dismiss">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
