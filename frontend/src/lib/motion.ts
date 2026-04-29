export const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 }
};

export const pageTransition: Transition = { duration: 0.18, ease: "easeOut" };
export const cardHover = { whileHover: { y: -2 }, transition: { duration: 0.12 } };

export const sidebarVariants = {
  expanded: { width: 240 },
  collapsed: { width: 64 }
};

export const listItemVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04 } })
};
import type { Transition } from "framer-motion";
