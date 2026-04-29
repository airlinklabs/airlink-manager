import { motion } from "framer-motion";
import { cn } from "../../lib/cn.ts";
import { cardHover } from "../../lib/motion.ts";

type CardProps = {
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
};

export function Card({ header, children, className, interactive = false }: CardProps) {
  const Component = interactive ? motion.div : "div";
  return (
    <Component
      {...(interactive ? cardHover : {})}
      className={cn("rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4 shadow-[var(--shadow-card)]", className)}
    >
      {header ? <div className="mb-3 flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">{header}</div> : null}
      {children}
    </Component>
  );
}
