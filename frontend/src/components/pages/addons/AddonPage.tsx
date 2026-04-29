import { motion } from "framer-motion";
import { Puzzle } from "lucide-react";
import { pageTransition, pageVariants } from "../../../lib/motion.ts";
import { Card } from "../../ui/Card.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { PageHeader } from "../../shell/PageHeader.tsx";

export function AddonPage() {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <PageHeader title="Addon" description="Sandboxed addon surface." />
      <Card>
        <EmptyState icon={Puzzle} title="Addon UI unavailable" message="No frontend bundle was registered for this addon." />
      </Card>
    </motion.div>
  );
}
