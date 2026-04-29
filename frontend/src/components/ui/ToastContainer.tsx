import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useNotifyStore } from "../../store/notify.store.ts";
import { Toast } from "./Toast.tsx";

export function ToastContainer() {
  const notifications = useNotifyStore((state) => state.notifications);
  const dismiss = useNotifyStore((state) => state.dismiss);

  useEffect(() => {
    const timers = notifications
      .filter((item) => item.level !== "error")
      .map((item) => window.setTimeout(() => dismiss(item.id), item.level === "warning" ? 6000 : 4000));
    return () => timers.forEach(window.clearTimeout);
  }, [dismiss, notifications]);

  return (
    <div className="fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence>
        {notifications.slice(0, 5).map((notification) => (
          <motion.div key={notification.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }}>
            <Toast notification={notification} onDismiss={dismiss} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
